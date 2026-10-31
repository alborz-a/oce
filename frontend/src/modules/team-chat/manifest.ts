import { lazy } from 'react';
import { MessagesSquare } from 'lucide-react';
import type { ModuleManifest } from '../_types';

/**
 * Team chat: company, project, group and direct rooms inside OCE, live over the app's own WebSocket.
 * Backend: `backend/app/modules/team_chat`. Sidebar row «گفتگو» in the Communication group; the project page links to
 * `/projects/:projectId/chat` (see README.md for the shared files this touches).
 */
export const manifest: ModuleManifest = {
  id: 'team-chat',
  name: 'team_chat.title',
  description: 'team_chat.description',
  version: '0.1.0',
  icon: MessagesSquare,
  category: 'tools',
  defaultEnabled: true,
  routes: [
    { path: '/chat', title: 'team_chat.title', component: lazy(() => import('./TeamChatModule')) },
    { path: '/chat/:roomId', title: 'team_chat.title', component: lazy(() => import('./TeamChatModule')) },
    { path: '/projects/:projectId/chat', title: 'team_chat.project_chat', component: lazy(() => import('./TeamChatModule')) },
  ],
  navItems: [
    {
      labelKey: 'team_chat.title',
      to: '/chat',
      icon: MessagesSquare,
      group: 'grp_communication',
    },
  ],
  translations: {
    fa: {
      'team_chat.title': 'گفتگو',
      'team_chat.description': 'گفتگوی شرکتی، پروژه‌ای، گروهی و مستقیم با به‌روزرسانی زنده',
      'team_chat.project_chat': 'گفتگوی پروژه',
      'team_chat.company': 'شرکت',
      'team_chat.new_group': 'گروه جدید',
      'team_chat.group_name': 'نام گروه',
      'team_chat.unnamed': 'بدون نام',
      'team_chat.pick': 'یک گفتگو را انتخاب کنید',
      'team_chat.placeholder': 'پیام خود را بنویسید…',
      'team_chat.send': 'ارسال',
      'team_chat.attach': 'پیوست سند',
      'team_chat.upload': 'بارگذاری فایل',
      'team_chat.document': 'سند',
      'team_chat.edited': 'ویرایش‌شده',
      'team_chat.load_older': 'پیام‌های قدیمی‌تر',
      'team_chat.offline': 'اتصال زنده قطع است؛ هر ۱۵ ثانیه به‌روزرسانی می‌شود',
      'team_chat.load_failed': 'بارگذاری گفتگوها ممکن نشد',
      'team_chat.no_access': 'به این گفتگو دسترسی ندارید',
      'team_chat.upload_failed': 'بارگذاری فایل ناموفق بود',
    },
    en: {
      'team_chat.title': 'Chat',
      'team_chat.description': 'Company, project, group and direct chat with live updates',
      'team_chat.project_chat': 'Project chat',
      'team_chat.company': 'Company',
      'team_chat.new_group': 'New group',
      'team_chat.group_name': 'Group name',
      'team_chat.unnamed': 'Unnamed',
      'team_chat.pick': 'Pick a conversation',
      'team_chat.placeholder': 'Write a message…',
      'team_chat.send': 'Send',
      'team_chat.attach': 'Attach document',
      'team_chat.upload': 'Upload file',
      'team_chat.document': 'Document',
      'team_chat.edited': 'edited',
      'team_chat.load_older': 'Older messages',
      'team_chat.offline': 'Live connection lost; refreshing every 15 seconds',
      'team_chat.load_failed': 'Could not load chats',
      'team_chat.no_access': 'You do not have access to this chat',
      'team_chat.upload_failed': 'File upload failed',
    },
  },
};
