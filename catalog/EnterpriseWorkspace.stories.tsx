import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState, type CSSProperties } from 'react';
import {
  AppNavigation,
  AppShell,
  BatchProgress,
  CommandPalette,
  NotificationCenter,
  RecordList,
  SettingsPanel,
  SplitView,
  Wizard,
  WorkspacePage,
} from '@ui-lazy-dev/ui-web/workflows';
import '@ui-lazy-dev/ui-web/workflows.css';
import { Button } from '@ui-lazy-dev/ui-web';
const meta = { title: 'Enterprise/Workspace', parameters: { layout: 'fullscreen' } } satisfies Meta;
export default meta;

function ReviewWorkspace({ regional = false }: { regional?: boolean }) {
  const title = regional ? 'مراجعة الفريق' : 'Application review';
  const names = regional
    ? [
        'مديرة تصميم المنتجات والتجارب الرقمية في مؤسسات دولية متعددة المواقع',
        '東京プロダクトデザイン・パートナーシップ部門',
        'Unternehmenskommunikationsverantwortliche',
      ]
    : Array.from({ length: 48 }, (_, i) => 'Opportunity ' + (i + 1));
  const items = names.map((label, i) => ({ id: String(i), label }));
  const [id, setId] = useState('0'),
    [drafts, setDrafts] = useState<Record<string, string>>({});
  const [invoker, setInvoker] = useState<HTMLButtonElement | null>(null);
  const listLabel = regional ? 'الفريق' : 'Position list',
    detailLabel = regional ? 'تفاصيل العضو' : 'Application details',
    notes = regional ? 'الملاحظات' : 'Review notes';
  const nav = [
    { id: 'review', href: '#review', label: regional ? 'المراجعة' : 'Review' },
    { id: 'notes', href: '#notes', label: notes },
  ];
  return (
    <div
      dir={regional ? 'rtl' : 'ltr'}
      lang={regional ? 'ar' : 'en'}
      style={{ '--uld-pane-max-height': '19rem' } as CSSProperties}
    >
      <AppShell
        skipLabel={regional ? 'انتقل إلى المحتوى' : 'Skip to content'}
        navigationLabel={regional ? 'مساحة العمل' : 'Workspace'}
        navigation={<AppNavigation items={nav} currentId="review" />}
      >
        <WorkspacePage
          title={title}
          actions={
            <Button onClick={(event) => setInvoker(event.currentTarget)}>
              {regional ? 'البحث عن أمر' : 'Find command'}
            </Button>
          }
        >
          <div id="review">
            <SplitView
              listLabel={listLabel}
              detailLabel={detailLabel}
              resizeLabel={regional ? 'تغيير حجم القائمة' : 'Resize list'}
              list={<RecordList label={listLabel} items={items} selectedId={id} onSelect={setId} />}
              detail={
                <div id="notes">
                  <h2>{items.find((item) => item.id === id)?.label}</h2>
                  <label style={{ display: 'grid', gap: '.4rem' }}>
                    {notes}
                    <textarea
                      rows={4}
                      value={drafts[id] ?? ''}
                      style={{ minInlineSize: 0, maxInlineSize: '100%', font: 'inherit' }}
                      onChange={(event) => setDrafts({ ...drafts, [id]: event.target.value })}
                    />
                  </label>
                </div>
              }
            />
          </div>
        </WorkspacePage>
      </AppShell>
      {invoker && (
        <CommandPalette
          returnFocusTo={invoker}
          label={regional ? 'الأوامر' : 'Workspace commands'}
          locale={regional ? 'ar' : 'en'}
          labels={
            regional ? { search: 'البحث', close: 'إغلاق', empty: 'لا توجد نتائج' } : undefined
          }
          commands={[
            { id: 'first', label: regional ? 'الأول' : 'Review first record' },
            { id: 'last', label: regional ? 'الأخير' : 'Review last record' },
          ]}
          onDismiss={() => setInvoker(null)}
          onChoose={(choice) => {
            setId(choice === 'last' ? String(items.length - 1) : '0');
            setInvoker(null);
          }}
        />
      )}
    </div>
  );
}
export const Review: StoryObj<typeof meta> = { render: () => <ReviewWorkspace /> };
export const RegionalTeam: StoryObj<typeof meta> = { render: () => <ReviewWorkspace regional /> };
const storageKey = 'uld-catalog-delivery-draft';
function DeliveryConsole() {
  const [draft, setDraft] = useState(() => {
    try {
      const value = JSON.parse(sessionStorage.getItem(storageKey) ?? 'null');
      if (
        value &&
        typeof value.destination === 'string' &&
        ['target', 'confirm'].includes(value.step)
      )
        return { step: String(value.step), destination: String(value.destination) };
    } catch {
      /* Storage may be denied. */
    }
    return { step: 'target', destination: '' };
  });
  const [done, setDone] = useState(false),
    [recovered, setRecovered] = useState(false),
    [read, setRead] = useState(false),
    [digest, setDigest] = useState(true);
  const update = (next: typeof draft) => {
    setDraft(next);
    try {
      sessionStorage.setItem(storageKey, JSON.stringify(next));
    } catch {
      /* Continue in memory. */
    }
  };
  return (
    <main className="uld-shell">
      <WorkspacePage title="Delivery console">
        {done ? (
          <p role="status">Delivery requested for {draft.destination}</p>
        ) : (
          <Wizard
            label="Delivery request"
            activeId={draft.step}
            onStepChange={(step) => update({ ...draft, step })}
            onFinish={() => setDone(true)}
            steps={[
              {
                id: 'target',
                label: 'Choose destination',
                content: (
                  <label>
                    Destination
                    <input
                      required
                      value={draft.destination}
                      onChange={(event) => update({ ...draft, destination: event.target.value })}
                    />
                  </label>
                ),
              },
              {
                id: 'confirm',
                label: 'Confirm delivery',
                content: <p>Deliver to {draft.destination}</p>,
              },
            ]}
          />
        )}
        <BatchProgress
          label="Deliverables"
          items={[
            { id: 'resume', label: 'Résumé', state: 'complete' },
            {
              id: 'portfolio',
              label: 'Portfolio',
              state: recovered ? 'complete' : 'failed',
              detail: recovered ? undefined : 'Connection interrupted',
            },
          ]}
          onRetry={() => setRecovered(true)}
        />
        <NotificationCenter
          label="Notifications"
          items={[{ id: 'resume', title: 'Résumé ready', read }]}
          onRead={() => setRead(true)}
          onReadAll={() => setRead(true)}
        />
        <SettingsPanel
          label="Preferences"
          groups={[
            {
              id: 'delivery',
              label: 'Delivery updates',
              settings: [
                {
                  id: 'digest',
                  label: 'Daily digest',
                  enabled: digest,
                  description: 'Include completed transfers.',
                },
              ],
            },
          ]}
          onChange={(_, value) => setDigest(value)}
        />
      </WorkspacePage>
    </main>
  );
}
export const Delivery: StoryObj<typeof meta> = { render: () => <DeliveryConsole /> };
