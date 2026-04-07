'use client';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription
} from '@/components/ui/dialog';
import { TaskForm } from './task-form';
import type { TaskWithContext } from '@/lib/tasks/types';
import type { CreateTaskInput } from '@/lib/tasks/validation';

type Member = { userId: string; name: string | null; email: string | null };

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  task?: TaskWithContext;
  members?: Member[];
  currentUserId?: string;
  onSubmit: (data: CreateTaskInput) => Promise<void>;
};

export function TaskModal({ open, onOpenChange, task, members, currentUserId, onSubmit }: Props) {
  const isOwner = !task || !currentUserId || task.userId === currentUserId;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[560px]">
        <DialogHeader>
          <DialogTitle>{task ? 'Edit task' : 'New task'}</DialogTitle>
          <DialogDescription>
            {task
              ? isOwner
                ? 'Update the details of your task.'
                : 'You can update the status of this assigned task.'
              : 'Add a new task to your list.'}
          </DialogDescription>
        </DialogHeader>
        <TaskForm
          task={task}
          members={members}
          isOwner={isOwner}
          onSubmit={async (data) => {
            await onSubmit(data);
            onOpenChange(false);
          }}
          onCancel={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  );
}
