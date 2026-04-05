import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('server-only', () => ({}));

vi.mock('@/lib/db', () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn()
  }
}));

// On mocke les notifications pour isoler la logique des organisations
vi.mock('@/lib/notifications/service', () => ({
  createNotification: vi.fn()
}));

import { db } from '@/lib/db';
import {
  createOrganization,
  inviteMember,
  acceptOrgInvitation,
  rejectOrgInvitation,
  removeMember
} from '@/lib/organizations/service';
import { createNotification } from '@/lib/notifications/service';

const mockDb = db as {
  select: ReturnType<typeof vi.fn>;
  insert: ReturnType<typeof vi.fn>;
  update: ReturnType<typeof vi.fn>;
  delete: ReturnType<typeof vi.fn>;
};

const mockCreateNotification = vi.mocked(createNotification);

// IMPORTANT : on utilise resetAllMocks (pas clearAllMocks) pour vider aussi
// la queue mockReturnValueOnce entre les tests, évitant les effets de bord
// quand un test échoue avant d'avoir consommé toutes ses valeurs mockées.
beforeEach(() => {
  vi.resetAllMocks();
  // On remet la notification en mode "réussit silencieusement"
  mockCreateNotification.mockResolvedValue(undefined);
});

// Helper : simule db.select().from().where()
function sel(data: unknown[]) {
  const where = vi.fn().mockResolvedValue(data);
  const from = vi.fn().mockReturnValue({ where });
  return { from };
}

// Helper : simule db.insert().values().returning()
function ins(data: unknown[]) {
  const returning = vi.fn().mockResolvedValue(data);
  const values = vi.fn().mockReturnValue({ returning });
  return { values };
}

// Helper : simule db.insert().values() sans returning (juste await values())
function insPlain() {
  const values = vi.fn().mockResolvedValue(undefined);
  return { values };
}

// Helper : simule db.insert().values().onConflictDoNothing()
function insConflict() {
  const onConflictDoNothing = vi.fn().mockResolvedValue(undefined);
  const values = vi.fn().mockReturnValue({ onConflictDoNothing });
  return { values };
}

// Helper : simule db.update().set().where()
function upd() {
  const where = vi.fn().mockResolvedValue(undefined);
  const set = vi.fn().mockReturnValue({ where });
  return { set };
}

// Données fictives
const mockOrg = {
  id: 'org-1',
  name: 'Acme Corp',
  description: null,
  createdBy: 'user-1',
  createdAt: new Date(),
  updatedAt: new Date()
};

const mockAdminMember = {
  organizationId: 'org-1',
  userId: 'user-1',
  role: 'admin' as const,
  joinedAt: new Date()
};

const mockRegularMember = {
  organizationId: 'org-1',
  userId: 'user-2',
  role: 'member' as const,
  joinedAt: new Date()
};

const mockInvitation = {
  id: 'inv-1',
  organizationId: 'org-1',
  senderId: 'user-1',
  receiverId: 'user-2',
  status: 'pending' as const,
  createdAt: new Date()
};

// ─── createOrganization ───────────────────────────────────────────────────────

describe('createOrganization', () => {
  it('crée l\'organisation et retourne l\'objet créé', async () => {
    // Vérifie le cas nominal : l'organisation est bien insérée en base
    mockDb.insert
      .mockReturnValueOnce(ins([mockOrg]))  // insert org avec .returning()
      .mockReturnValueOnce(insPlain());      // insert créateur comme admin (sans returning)

    const result = await createOrganization({ name: 'Acme Corp' }, 'user-1');
    expect(result.name).toBe('Acme Corp');
    expect(result.createdBy).toBe('user-1');
  });

  it('fait deux insertions : une pour l\'org et une pour le créateur comme admin', async () => {
    // Vérifie que le créateur est automatiquement ajouté comme admin de son organisation
    const memberValues = vi.fn().mockResolvedValue(undefined);
    mockDb.insert
      .mockReturnValueOnce(ins([mockOrg]))
      .mockReturnValueOnce({ values: memberValues });

    await createOrganization({ name: 'Acme Corp' }, 'user-1');

    // 2 appels à insert : org + membre
    expect(mockDb.insert).toHaveBeenCalledTimes(2);
    // Le 2ème appel (membre) doit inclure role: 'admin' et le userId du créateur
    expect(memberValues).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'user-1', role: 'admin' })
    );
  });
});

// ─── inviteMember ─────────────────────────────────────────────────────────────

describe('inviteMember', () => {
  it('lève FORBIDDEN si l\'invitant n\'est pas admin', async () => {
    // Seul un admin peut inviter des membres dans une organisation
    mockDb.select.mockReturnValueOnce(sel([mockRegularMember]));
    await expect(inviteMember('org-1', 'user-2', 'user-3')).rejects.toMatchObject({
      code: 'FORBIDDEN'
    });
  });

  it('lève FORBIDDEN si l\'invitant n\'est pas membre de l\'org', async () => {
    // Un utilisateur extérieur ne peut pas inviter dans une org
    mockDb.select.mockReturnValueOnce(sel([]));
    await expect(inviteMember('org-1', 'user-99', 'user-3')).rejects.toMatchObject({
      code: 'FORBIDDEN'
    });
  });

  it('lève BAD_REQUEST si l\'invitant et le destinataire sont la même personne', async () => {
    // Vérifie qu'on ne peut pas s'inviter soi-même
    mockDb.select.mockReturnValueOnce(sel([mockAdminMember]));
    await expect(inviteMember('org-1', 'user-1', 'user-1')).rejects.toMatchObject({
      code: 'BAD_REQUEST'
    });
  });

  it('lève BAD_REQUEST si le destinataire n\'est pas un contact', async () => {
    // Vérifie la contrainte "contacts seulement"
    mockDb.select
      .mockReturnValueOnce(sel([mockAdminMember]))  // requireAdmin OK
      .mockReturnValueOnce(sel([]));                 // areContacts → pas contacts
    await expect(inviteMember('org-1', 'user-1', 'user-3')).rejects.toMatchObject({
      code: 'BAD_REQUEST'
    });
  });

  it('lève BAD_REQUEST si le destinataire est déjà membre', async () => {
    // Vérifie qu'on ne peut pas ré-inviter un membre existant
    mockDb.select
      .mockReturnValueOnce(sel([mockAdminMember]))    // requireAdmin
      .mockReturnValueOnce(sel([{ id: 'rel-1' }]))   // areContacts → sont contacts
      .mockReturnValueOnce(sel([mockRegularMember])); // déjà membre
    await expect(inviteMember('org-1', 'user-1', 'user-2')).rejects.toMatchObject({
      code: 'BAD_REQUEST'
    });
  });

  it('lève BAD_REQUEST si une invitation est déjà pending', async () => {
    // Vérifie qu'on ne peut pas envoyer deux invitations identiques
    mockDb.select
      .mockReturnValueOnce(sel([mockAdminMember]))
      .mockReturnValueOnce(sel([{ id: 'rel-1' }]))
      .mockReturnValueOnce(sel([]))                    // pas encore membre
      .mockReturnValueOnce(sel([mockInvitation]));     // invitation déjà pending
    await expect(inviteMember('org-1', 'user-1', 'user-2')).rejects.toMatchObject({
      code: 'BAD_REQUEST'
    });
  });

  it('appelle db.insert une fois et notifie le destinataire', async () => {
    // Vérifie le cas nominal : insertion en BDD et notification envoyée
    // Séquence des selects dans inviteMember :
    //   1. requireAdmin → admin member
    //   2. areContacts → relation contact trouvée
    //   3. existingMember check → vide (pas encore membre)
    //   4. existingInvitation check → vide (pas d'invitation)
    //   5 & 6. Promise.all : org name + sender name (pour notification)
    mockDb.select
      .mockReturnValueOnce(sel([mockAdminMember]))
      .mockReturnValueOnce(sel([{ id: 'rel-1' }]))
      .mockReturnValueOnce(sel([]))
      .mockReturnValueOnce(sel([]))
      .mockReturnValueOnce(sel([{ name: 'Acme Corp' }]))
      .mockReturnValueOnce(sel([{ name: 'Alice', email: 'alice@example.com' }]));

    mockDb.insert.mockReturnValueOnce(ins([mockInvitation]));

    await inviteMember('org-1', 'user-1', 'user-2');

    // L'invitation a bien été insérée
    expect(mockDb.insert).toHaveBeenCalledOnce();

    // La notification est envoyée au destinataire
    await vi.waitFor(() => expect(mockCreateNotification).toHaveBeenCalledOnce());
    expect(mockCreateNotification).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'user-2', type: 'org_invitation_received' })
    );
  });
});

// ─── acceptOrgInvitation ──────────────────────────────────────────────────────

describe('acceptOrgInvitation', () => {
  it('lève NOT_FOUND si l\'invitation n\'existe pas', async () => {
    // Vérifie qu'on ne peut pas accepter une invitation inexistante
    mockDb.select.mockReturnValueOnce(sel([]));
    await expect(acceptOrgInvitation('bad-id', 'user-2')).rejects.toMatchObject({
      code: 'NOT_FOUND'
    });
  });

  it('lève FORBIDDEN si l\'utilisateur n\'est pas le destinataire', async () => {
    // Seul le destinataire de l'invitation peut l'accepter
    mockDb.select.mockReturnValueOnce(sel([mockInvitation]));
    await expect(acceptOrgInvitation('inv-1', 'user-99')).rejects.toMatchObject({
      code: 'FORBIDDEN'
    });
  });

  it('lève BAD_REQUEST si l\'invitation n\'est pas pending', async () => {
    // On ne peut pas accepter une invitation déjà traitée
    mockDb.select.mockReturnValueOnce(sel([{ ...mockInvitation, status: 'accepted' }]));
    await expect(acceptOrgInvitation('inv-1', 'user-2')).rejects.toMatchObject({
      code: 'BAD_REQUEST'
    });
  });

  it('met à jour l\'invitation et ajoute l\'utilisateur comme membre', async () => {
    // Vérifie le cas nominal : invitation acceptée et nouveau membre ajouté
    // Séquence : 1. get invitation, 2. Promise.all (acceptor name + org name pour notif)
    mockDb.select
      .mockReturnValueOnce(sel([mockInvitation]))
      .mockReturnValueOnce(sel([{ name: 'Bob', email: 'bob@b.com' }]))  // acceptor
      .mockReturnValueOnce(sel([{ name: 'Acme Corp' }]));               // org

    mockDb.update.mockReturnValue(upd());

    // acceptOrgInvitation utilise .onConflictDoNothing() sur le membre insert
    mockDb.insert.mockReturnValueOnce(insConflict());

    await acceptOrgInvitation('inv-1', 'user-2');

    // Un update (invitation → accepted) + un insert (nouveau membre)
    expect(mockDb.update).toHaveBeenCalledOnce();
    expect(mockDb.insert).toHaveBeenCalledOnce();
  });

  it('notifie l\'expéditeur de l\'invitation', async () => {
    // Vérifie que l'expéditeur est prévenu quand son invitation est acceptée
    mockDb.select
      .mockReturnValueOnce(sel([mockInvitation]))
      .mockReturnValueOnce(sel([{ name: 'Bob', email: 'bob@b.com' }]))
      .mockReturnValueOnce(sel([{ name: 'Acme Corp' }]));

    mockDb.update.mockReturnValue(upd());
    mockDb.insert.mockReturnValueOnce(insConflict());

    await acceptOrgInvitation('inv-1', 'user-2');

    await vi.waitFor(() => expect(mockCreateNotification).toHaveBeenCalledOnce());
    expect(mockCreateNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1', // expéditeur de l'invitation
        type: 'org_invitation_accepted'
      })
    );
  });
});

// ─── rejectOrgInvitation ──────────────────────────────────────────────────────

describe('rejectOrgInvitation', () => {
  it('lève NOT_FOUND si l\'invitation n\'existe pas', async () => {
    // Vérifie qu'on ne peut pas rejeter une invitation inexistante
    mockDb.select.mockReturnValueOnce(sel([]));
    await expect(rejectOrgInvitation('bad-id', 'user-2')).rejects.toMatchObject({
      code: 'NOT_FOUND'
    });
  });

  it('lève FORBIDDEN si l\'utilisateur n\'est pas le destinataire', async () => {
    // Seul le destinataire peut rejeter une invitation
    mockDb.select.mockReturnValueOnce(sel([mockInvitation]));
    await expect(rejectOrgInvitation('inv-1', 'user-99')).rejects.toMatchObject({
      code: 'FORBIDDEN'
    });
  });

  it('met à jour le statut à rejected', async () => {
    // Vérifie que le rejet modifie bien le statut de l'invitation en base
    mockDb.select.mockReturnValueOnce(sel([mockInvitation]));
    mockDb.update.mockReturnValue(upd());

    await rejectOrgInvitation('inv-1', 'user-2');

    expect(mockDb.update).toHaveBeenCalledOnce();
    // Le set doit passer { status: 'rejected' }
    const setFn = mockDb.update.mock.results[0].value.set;
    expect(setFn).toHaveBeenCalledWith({ status: 'rejected' });
  });
});

// ─── removeMember ─────────────────────────────────────────────────────────────

describe('removeMember', () => {
  it('lève FORBIDDEN si l\'utilisateur courant n\'est pas membre', async () => {
    // Un non-membre ne peut pas retirer quelqu'un de l'organisation
    mockDb.select.mockReturnValueOnce(sel([]));
    await expect(removeMember('org-1', 'user-2', 'user-99')).rejects.toMatchObject({
      code: 'FORBIDDEN'
    });
  });

  it('lève FORBIDDEN si un simple membre essaie de retirer quelqu\'un d\'autre', async () => {
    // Un membre (non admin) peut seulement se retirer lui-même
    mockDb.select.mockReturnValueOnce(sel([mockRegularMember]));
    await expect(removeMember('org-1', 'user-3', 'user-2')).rejects.toMatchObject({
      code: 'FORBIDDEN'
    });
  });

  it('autorise un membre à se retirer lui-même', async () => {
    // Un utilisateur peut toujours quitter une organisation de lui-même
    mockDb.select.mockReturnValueOnce(sel([mockRegularMember]));
    mockDb.delete.mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) });

    await removeMember('org-1', 'user-2', 'user-2'); // targetUserId === currentUserId
    expect(mockDb.delete).toHaveBeenCalledOnce();
  });

  it('autorise un admin à retirer un autre membre', async () => {
    // Un admin peut retirer n'importe quel membre de l'organisation
    mockDb.select
      .mockReturnValueOnce(sel([mockAdminMember]))    // currentUser est admin
      .mockReturnValueOnce(sel([mockRegularMember])); // target existe bien

    mockDb.delete.mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) });

    await removeMember('org-1', 'user-2', 'user-1');
    expect(mockDb.delete).toHaveBeenCalledOnce();
  });
});
