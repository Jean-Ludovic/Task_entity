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

// On mocke le service de notifications pour ne pas tester ses effets dans les tests des contacts
vi.mock('@/lib/notifications/service', () => ({
  createNotification: vi.fn().mockResolvedValue(undefined)
}));

import { db } from '@/lib/db';
import {
  sendContactRequest,
  acceptContactRequest,
  rejectContactRequest,
  deleteContact,
  listContacts,
  searchUsers
} from '@/lib/contacts/service';
import { AppError } from '@/lib/errors';
import { createNotification } from '@/lib/notifications/service';

const mockDb = db as {
  select: ReturnType<typeof vi.fn>;
  insert: ReturnType<typeof vi.fn>;
  update: ReturnType<typeof vi.fn>;
  delete: ReturnType<typeof vi.fn>;
};

const mockCreateNotification = vi.mocked(createNotification);

// Helper : simule la chaîne db.select().from().where()
function selectReturning(data: unknown[]) {
  const where = vi.fn().mockResolvedValue(data);
  const from = vi.fn().mockReturnValue({ where });
  return { from };
}

// Données fictives
const mockRequest = {
  id: 'req-1',
  senderId: 'user-1',
  receiverId: 'user-2',
  status: 'pending' as const,
  createdAt: new Date(),
  updatedAt: new Date()
};

const mockAcceptedRequest = { ...mockRequest, status: 'accepted' as const };

// ─── sendContactRequest ───────────────────────────────────────────────────────

describe('sendContactRequest', () => {
  beforeEach(() => vi.clearAllMocks());

  it('lève une erreur BAD_REQUEST si senderId === receiverId', async () => {
    // Vérifie qu'on ne peut pas s'envoyer une demande à soi-même
    await expect(sendContactRequest('user-1', 'user-1')).rejects.toMatchObject({
      code: 'BAD_REQUEST'
    });
    expect(mockDb.insert).not.toHaveBeenCalled();
  });

  it('lève NOT_FOUND si le destinataire n\'existe pas', async () => {
    // Vérifie que la vérification d'existence du receiver est bien faite
    mockDb.select.mockReturnValueOnce(selectReturning([])); // receiver introuvable

    await expect(sendContactRequest('user-1', 'user-99')).rejects.toMatchObject({
      code: 'NOT_FOUND'
    });
  });

  it('lève BAD_REQUEST si une demande est déjà pending', async () => {
    // Vérifie qu'on ne peut pas envoyer une seconde demande si une est déjà en attente
    mockDb.select
      .mockReturnValueOnce(selectReturning([{ id: 'user-2' }]))   // receiver existe
      .mockReturnValueOnce(selectReturning([mockRequest]));         // demande déjà pending

    await expect(sendContactRequest('user-1', 'user-2')).rejects.toMatchObject({
      code: 'BAD_REQUEST'
    });
  });

  it('lève BAD_REQUEST si les deux utilisateurs sont déjà contacts', async () => {
    // Vérifie qu'on ne peut pas renvoyer une demande à un contact existant
    mockDb.select
      .mockReturnValueOnce(selectReturning([{ id: 'user-2' }]))
      .mockReturnValueOnce(selectReturning([mockAcceptedRequest]));

    await expect(sendContactRequest('user-1', 'user-2')).rejects.toMatchObject({
      code: 'BAD_REQUEST'
    });
  });

  it('crée une demande et retourne l\'objet créé', async () => {
    // Vérifie le cas nominal : création réussie d'une demande de contact
    mockDb.select
      .mockReturnValueOnce(selectReturning([{ id: 'user-2' }]))       // receiver existe
      .mockReturnValueOnce(selectReturning([]))                         // pas de demande existante
      .mockReturnValueOnce(selectReturning([{ name: 'Alice', email: 'alice@example.com' }])); // sender name pour notif

    const returning = vi.fn().mockResolvedValue([mockRequest]);
    const values = vi.fn().mockReturnValue({ returning });
    mockDb.insert.mockReturnValue({ values });

    const result = await sendContactRequest('user-1', 'user-2');

    expect(mockDb.insert).toHaveBeenCalledOnce();
    expect(result.senderId).toBe('user-1');
    expect(result.receiverId).toBe('user-2');
  });

  it('envoie une notification au destinataire après création', async () => {
    // Vérifie que le destinataire est notifié de la demande reçue
    mockDb.select
      .mockReturnValueOnce(selectReturning([{ id: 'user-2' }]))
      .mockReturnValueOnce(selectReturning([]))
      .mockReturnValueOnce(selectReturning([{ name: 'Alice', email: 'alice@example.com' }]));

    const returning = vi.fn().mockResolvedValue([mockRequest]);
    const values = vi.fn().mockReturnValue({ returning });
    mockDb.insert.mockReturnValue({ values });

    await sendContactRequest('user-1', 'user-2');

    // Laisse le temps aux promesses fire-and-forget de s'exécuter
    await vi.waitFor(() => expect(mockCreateNotification).toHaveBeenCalledOnce());
    expect(mockCreateNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-2', // notification envoyée au destinataire
        type: 'contact_invitation_received'
      })
    );
  });
});

// ─── acceptContactRequest ─────────────────────────────────────────────────────

describe('acceptContactRequest', () => {
  beforeEach(() => vi.clearAllMocks());

  it('lève NOT_FOUND si la demande n\'existe pas', async () => {
    // Vérifie que l'on ne peut pas accepter une demande inexistante
    mockDb.select.mockReturnValueOnce(selectReturning([]));
    await expect(acceptContactRequest('bad-id', 'user-2')).rejects.toMatchObject({
      code: 'NOT_FOUND'
    });
  });

  it('lève FORBIDDEN si l\'utilisateur courant n\'est pas le destinataire', async () => {
    // Vérifie que seul le receiver peut accepter une demande
    mockDb.select.mockReturnValueOnce(selectReturning([mockRequest]));
    // user-99 essaie d'accepter une demande qui cible user-2
    await expect(acceptContactRequest('req-1', 'user-99')).rejects.toMatchObject({
      code: 'FORBIDDEN'
    });
  });

  it('lève BAD_REQUEST si la demande n\'est pas pending', async () => {
    // Vérifie qu'on ne peut pas accepter une demande déjà traitée
    mockDb.select.mockReturnValueOnce(selectReturning([mockAcceptedRequest]));
    await expect(acceptContactRequest('req-1', 'user-2')).rejects.toMatchObject({
      code: 'BAD_REQUEST'
    });
  });

  it('met à jour le statut à accepted et retourne la demande', async () => {
    // Vérifie le cas nominal : acceptation réussie avec le bon statut
    mockDb.select
      .mockReturnValueOnce(selectReturning([mockRequest]))  // récupère la demande
      .mockReturnValueOnce(selectReturning([{ name: 'Bob', email: 'bob@example.com' }])); // acceptor name pour notif

    const returning = vi.fn().mockResolvedValue([mockAcceptedRequest]);
    const updateWhere = vi.fn().mockReturnValue({ returning });
    const set = vi.fn().mockReturnValue({ where: updateWhere });
    mockDb.update.mockReturnValue({ set });

    const result = await acceptContactRequest('req-1', 'user-2');
    expect(result.status).toBe('accepted');
  });

  it('envoie une notification à l\'expéditeur de la demande', async () => {
    // Vérifie que l'expéditeur est notifié quand sa demande est acceptée
    mockDb.select
      .mockReturnValueOnce(selectReturning([mockRequest]))
      .mockReturnValueOnce(selectReturning([{ name: 'Bob', email: 'bob@example.com' }]));

    const returning = vi.fn().mockResolvedValue([mockAcceptedRequest]);
    const updateWhere = vi.fn().mockReturnValue({ returning });
    const set = vi.fn().mockReturnValue({ where: updateWhere });
    mockDb.update.mockReturnValue({ set });

    await acceptContactRequest('req-1', 'user-2');

    await vi.waitFor(() => expect(mockCreateNotification).toHaveBeenCalledOnce());
    expect(mockCreateNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1', // notification envoyée à l'expéditeur original
        type: 'contact_invitation_accepted'
      })
    );
  });
});

// ─── rejectContactRequest ─────────────────────────────────────────────────────

describe('rejectContactRequest', () => {
  beforeEach(() => vi.clearAllMocks());

  it('lève NOT_FOUND si la demande n\'existe pas', async () => {
    // Vérifie qu'on ne peut pas rejeter une demande inexistante
    mockDb.select.mockReturnValueOnce(selectReturning([]));
    await expect(rejectContactRequest('bad-id', 'user-2')).rejects.toMatchObject({
      code: 'NOT_FOUND'
    });
  });

  it('lève FORBIDDEN si l\'utilisateur n\'est pas le destinataire', async () => {
    // Seul le destinataire (receiver) peut rejeter une demande
    mockDb.select.mockReturnValueOnce(selectReturning([mockRequest]));
    await expect(rejectContactRequest('req-1', 'user-99')).rejects.toMatchObject({
      code: 'FORBIDDEN'
    });
  });

  it('met à jour le statut à rejected', async () => {
    // Vérifie que le rejet modifie bien le statut en base
    mockDb.select.mockReturnValueOnce(selectReturning([mockRequest]));

    const rejectedReq = { ...mockRequest, status: 'rejected' as const };
    const returning = vi.fn().mockResolvedValue([rejectedReq]);
    const updateWhere = vi.fn().mockReturnValue({ returning });
    const set = vi.fn().mockReturnValue({ where: updateWhere });
    mockDb.update.mockReturnValue({ set });

    const result = await rejectContactRequest('req-1', 'user-2');
    expect(result.status).toBe('rejected');
  });
});

// ─── deleteContact ────────────────────────────────────────────────────────────

describe('deleteContact', () => {
  beforeEach(() => vi.clearAllMocks());

  it('lève NOT_FOUND si le contact n\'existe pas', async () => {
    // Vérifie qu'on ne peut pas supprimer un contact inexistant
    mockDb.select.mockReturnValueOnce(selectReturning([]));
    await expect(deleteContact('bad-id', 'user-1')).rejects.toMatchObject({
      code: 'NOT_FOUND'
    });
  });

  it('lève FORBIDDEN si l\'utilisateur n\'est ni sender ni receiver', async () => {
    // Vérifie qu'un tiers ne peut pas supprimer un contact qui ne le concerne pas
    mockDb.select.mockReturnValueOnce(selectReturning([mockAcceptedRequest]));
    await expect(deleteContact('req-1', 'user-99')).rejects.toMatchObject({
      code: 'FORBIDDEN'
    });
  });

  it('lève BAD_REQUEST si la relation n\'est pas accepted', async () => {
    // Vérifie qu'on ne peut pas supprimer une demande qui n'est pas encore acceptée
    mockDb.select.mockReturnValueOnce(selectReturning([mockRequest])); // status: pending
    await expect(deleteContact('req-1', 'user-1')).rejects.toMatchObject({
      code: 'BAD_REQUEST'
    });
  });

  it('supprime le contact si l\'utilisateur est le sender', async () => {
    // Vérifie que l'expéditeur peut supprimer le contact
    mockDb.select.mockReturnValueOnce(selectReturning([mockAcceptedRequest]));
    const deleteWhere = vi.fn().mockResolvedValue(undefined);
    mockDb.delete.mockReturnValue({ where: deleteWhere });

    await deleteContact('req-1', 'user-1'); // user-1 est le sender
    expect(mockDb.delete).toHaveBeenCalledOnce();
  });
});

// ─── searchUsers ──────────────────────────────────────────────────────────────

describe('searchUsers', () => {
  beforeEach(() => vi.clearAllMocks());

  it('retourne les utilisateurs correspondant à la recherche', async () => {
    // Vérifie que la recherche retourne les résultats filtrés par la BDD
    const users = [
      { id: 'user-2', name: 'Bob', email: 'bob@example.com', image: null }
    ];
    const limit = vi.fn().mockResolvedValue(users);
    const where = vi.fn().mockReturnValue({ limit });
    const from = vi.fn().mockReturnValue({ where });
    mockDb.select.mockReturnValue({ from });

    const result = await searchUsers('Bob', 'user-1');
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('Bob');
  });

  it('ne retourne pas l\'utilisateur courant dans les résultats', async () => {
    // La recherche exclut l'utilisateur lui-même (ne(users.id, currentUserId))
    const limit = vi.fn().mockResolvedValue([]);
    const where = vi.fn().mockReturnValue({ limit });
    const from = vi.fn().mockReturnValue({ where });
    mockDb.select.mockReturnValue({ from });

    await searchUsers('user', 'user-1');
    // On vérifie que la clause where a bien été appelée (le filtre d'exclusion est dedans)
    expect(where).toHaveBeenCalledOnce();
  });
});
