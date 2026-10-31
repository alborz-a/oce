// System-admin editor for one module guide: who sees it (global / role / user) and its text.

import { useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import { guideOverridesApi, type GuideTextOverride } from './guideOverrides';
import type { ModuleGuideContent } from './ModuleGuide';

interface Props {
  open: boolean;
  onClose: () => void;
  moduleKey: string;
  base: ModuleGuideContent;
}

const ROLES = ['admin', 'manager', 'editor', 'viewer'];

export function GuideEditorDialog({ open, onClose, moduleKey, base }: Props) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [scope, setScope] = useState<'global' | 'role' | 'user'>('global');
  const [scopeValue, setScopeValue] = useState('');
  const [visible, setVisible] = useState(true);
  const [title, setTitle] = useState(() => t(base.titleKey, { defaultValue: base.titleDefault }));
  const [intro, setIntro] = useState(() =>
    base.introKey ? t(base.introKey, { defaultValue: base.introDefault }) : '',
  );
  const [bodies, setBodies] = useState<{ title: string; body: string }[]>(() =>
    base.sections.map((s) => ({
      title: t(s.titleKey, { defaultValue: s.titleDefault }),
      body: t(s.bodyKey, { defaultValue: s.bodyDefault }),
    })),
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  const save = async (withText: boolean) => {
    setBusy(true);
    setError(null);
    try {
      const content: GuideTextOverride | null = withText ? { title, intro, sections: bodies } : null;
      await guideOverridesApi.save({
        module_key: moduleKey,
        scope,
        scope_value: scope === 'global' ? '' : scopeValue,
        visible,
        content,
      });
      await qc.invalidateQueries({ queryKey: ['guide-overrides'] });
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const inputCls =
    'w-full rounded-lg border border-border-light bg-surface-primary px-2 py-1.5 text-sm text-content-primary';

  return createPortal(
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true">
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl bg-surface-elevated p-5 shadow-xl space-y-3">
        <h2 className="text-base font-semibold text-content-primary">
          {t('guide.editor.title', { defaultValue: 'Edit guide' })}: {moduleKey}
        </h2>
        <div className="flex flex-wrap gap-2">
          <select className={inputCls + ' !w-auto'} value={scope} onChange={(e) => setScope(e.target.value as typeof scope)}>
            <option value="global">{t('guide.editor.scope_global', { defaultValue: 'Everyone' })}</option>
            <option value="role">{t('guide.editor.scope_role', { defaultValue: 'Role' })}</option>
            <option value="user">{t('guide.editor.scope_user', { defaultValue: 'One user (id)' })}</option>
          </select>
          {scope === 'role' && (
            <select className={inputCls + ' !w-auto'} value={scopeValue} onChange={(e) => setScopeValue(e.target.value)}>
              <option value="">-</option>
              {ROLES.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          )}
          {scope === 'user' && (
            <input className={inputCls + ' !w-64'} value={scopeValue} onChange={(e) => setScopeValue(e.target.value)} placeholder="user id" />
          )}
          <label className="inline-flex items-center gap-1.5 text-sm text-content-secondary">
            <input type="checkbox" checked={visible} onChange={(e) => setVisible(e.target.checked)} />
            {t('guide.editor.visible', { defaultValue: 'Show this guide' })}
          </label>
        </div>
        <input className={inputCls} value={title} onChange={(e) => setTitle(e.target.value)} />
        {base.introKey && <textarea className={inputCls} rows={2} value={intro} onChange={(e) => setIntro(e.target.value)} />}
        {bodies.map((s, i) => (
          <div key={i} className="space-y-1 rounded-lg border border-border-light p-2">
            <input
              className={inputCls}
              value={s.title}
              onChange={(e) => setBodies((p) => p.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)))}
            />
            <textarea
              className={inputCls}
              rows={3}
              value={s.body}
              onChange={(e) => setBodies((p) => p.map((x, j) => (j === i ? { ...x, body: e.target.value } : x)))}
            />
          </div>
        ))}
        {error && <p className="text-xs text-semantic-error">{error}</p>}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="h-8 rounded-lg border border-border-light px-3 text-xs">
            {t('common.cancel', { defaultValue: 'Cancel' })}
          </button>
          <button
            type="button"
            disabled={busy || (scope !== 'global' && !scopeValue)}
            onClick={() => void save(false)}
            className="h-8 rounded-lg border border-border-light px-3 text-xs disabled:opacity-50"
            title={t('guide.editor.visibility_only_hint', { defaultValue: 'Save visibility only, keep the built-in text' })}
          >
            {t('guide.editor.save_visibility', { defaultValue: 'Save visibility only' })}
          </button>
          <button
            type="button"
            disabled={busy || (scope !== 'global' && !scopeValue)}
            onClick={() => void save(true)}
            className="h-8 rounded-lg bg-oe-blue px-3 text-xs font-semibold text-white disabled:opacity-50"
          >
            {t('common.save', { defaultValue: 'Save' })}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
