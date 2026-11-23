import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { LETTERS_UNREAD_COUNT_KEY } from '@/features/projects/workspace/hooks/useLettersUnreadCount';
import {
  lettersApi,
  type MailboxBox,
  type MailboxFilters,
  type ComposeBody,
  type SecretariatPrefix,
} from './lettersApi';

export const LETTERS_MAILBOX_KEY = ['letters-mailbox'] as const;
export const LETTERS_THREAD_KEY = ['letters-thread'] as const;

export function useMailbox(box: MailboxBox, filters: MailboxFilters = {}) {
  return useQuery({
    queryKey: [...LETTERS_MAILBOX_KEY, box, filters],
    queryFn: () => lettersApi.mailbox(box, filters),
    staleTime: 15_000,
  });
}

export function useLetterThread(id: string | null) {
  return useQuery({
    queryKey: [...LETTERS_THREAD_KEY, id],
    queryFn: () => lettersApi.thread(id as string),
    enabled: Boolean(id),
  });
}

export function useLettersInvalidate() {
  const qc = useQueryClient();
  return () => {
    void qc.invalidateQueries({ queryKey: LETTERS_MAILBOX_KEY });
    void qc.invalidateQueries({ queryKey: LETTERS_THREAD_KEY });
    void qc.invalidateQueries({ queryKey: LETTERS_UNREAD_COUNT_KEY });
  };
}

export function useComposeLetter() {
  const invalidate = useLettersInvalidate();
  return useMutation({
    mutationFn: (body: ComposeBody) => lettersApi.compose(body),
    onSuccess: invalidate,
  });
}

export function useReplyLetter(id: string) {
  const invalidate = useLettersInvalidate();
  return useMutation({
    mutationFn: (body: string) => lettersApi.reply(id, body),
    onSuccess: invalidate,
  });
}

export function useForwardLetter(id: string) {
  const invalidate = useLettersInvalidate();
  return useMutation({
    mutationFn: (args: { toUserIds: string[]; note: string }) =>
      lettersApi.forward(id, args.toUserIds, args.note),
    onSuccess: invalidate,
  });
}

export function useRegisterLetter(id: string) {
  const invalidate = useLettersInvalidate();
  return useMutation({
    mutationFn: (prefix: SecretariatPrefix) => lettersApi.register(id, prefix),
    onSuccess: invalidate,
  });
}

export function useArchiveLetter(id: string) {
  const invalidate = useLettersInvalidate();
  return useMutation({
    mutationFn: (archive: boolean) => (archive ? lettersApi.archive(id) : lettersApi.unarchive(id)),
    onSuccess: invalidate,
  });
}

export function useMarkLetterRead() {
  const invalidate = useLettersInvalidate();
  return useMutation({
    mutationFn: (id: string) => lettersApi.markRead(id),
    onSuccess: invalidate,
  });
}

export const LETTERS_LABELS_KEY = ['letters-labels'] as const;

export function useLabels() {
  return useQuery({
    queryKey: LETTERS_LABELS_KEY,
    queryFn: () => lettersApi.labels(),
    staleTime: 30_000,
  });
}

export function useCreateLabel() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (name: string) => lettersApi.createLabel(name),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: LETTERS_LABELS_KEY });
    },
  });
}

/** Attach or detach one label on one letter; invalidates mailbox and thread so chips refresh. */
export function useToggleLetterLabel(letterId: string) {
  const invalidate = useLettersInvalidate();
  return useMutation({
    mutationFn: (args: { labelId: string; attach: boolean }) =>
      args.attach
        ? lettersApi.attachLabel(letterId, args.labelId)
        : lettersApi.detachLabel(letterId, args.labelId),
    onSuccess: invalidate,
  });
}
