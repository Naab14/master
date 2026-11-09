/* Sketch boards: the open-source Excalidraw editor, with named boards saved
 * on the server. A board is private to its owner until shared.
 *
 * Not live collaboration: each person's changes are saved as a whole, and
 * others see them a few seconds later when they are not drawing. Two people
 * drawing at once are told, and nobody's version is silently overwritten.
 */
import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { Button, Pill, useToast } from '../ui';
import { useI18n } from '../i18n';
import { apiFetch } from '../access';
import { useWorkforce } from './store-context';
import { Confirm, Empty, Field, Input, PageHeader, Select, Sheet } from './ui';
import { list } from './logic/model';

const Editor = lazy(() => import('./SketchEditor.jsx'));
const boardFromHash = () => (window.location.hash.match(/^#\/sketch\/(.+)$/) || [])[1] || null;

async function api(method, path, body) {
  const r = await apiFetch(path, { method, headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  const data = await r.json().catch(() => ({}));
  return { ok: r.ok, status: r.status, data };
}

export default function SketchView() {
  const { t, fmt } = useI18n();
  const toast = useToast();
  const { offline, me } = useWorkforce();
  const [boards, setBoards] = useState(null);
  const [info, setInfo] = useState({ me: '', externalGuests: false });
  const [openId, setOpenId] = useState(boardFromHash);
  const [name, setName] = useState('');
  const isGuest = me?.role === 'guest';

  const refresh = useCallback(async () => {
    const r = await api('GET', '/api/sketches').catch(() => null);
    if (r?.ok) { setBoards(r.data.boards); setInfo({ me: r.data.me, externalGuests: r.data.externalGuests }); }
    return r?.ok ? r.data.boards : null;
  }, []);
  useEffect(() => {
    let live = true;
    api('GET', '/api/sketches').then(r => { if (live && r.ok) { setBoards(r.data.boards); setInfo({ me: r.data.me, externalGuests: r.data.externalGuests }); } }).catch(() => {});
    return () => { live = false; };
  }, []);
  const open = id => { setOpenId(id); window.history.replaceState(null, '', id ? `#/sketch/${id}` : '#/sketch'); if (!id) refresh(); };
  const create = async () => {
    const r = await api('POST', '/api/sketches', { name: name.trim() });
    if (r.ok) { setName(''); await refresh(); open(r.data.id); } else toast(r.data.error || t('That could not be saved: {why}', { why: r.status }));
  };

  if (openId) return <Board id={openId} info={info} onBack={() => open(null)} boardsMeta={boards} refresh={refresh} />;

  const mine = (boards || []).filter(b => b.mine);
  const shared = (boards || []).filter(b => !b.mine);
  const card = b => (
    <button type="button" key={b.id} className="ui-focus flex flex-col gap-1 rounded-panel border border-line bg-panel p-4 text-left hover:bg-soft" onClick={() => open(b.id)}>
      <strong className="text-sm">{b.name}</strong>
      <span className="text-xs text-ink-3">{t('Changed {when}', { when: fmt.stamp(Date.parse(b.updatedAt)) })}{!b.mine ? ` · ${b.owner}` : ''}</span>
      <span className="mt-1 flex flex-wrap gap-1">
        {b.mine && (b.shared?.length ? <Pill tone="pending">{t('Shared with {n}', { n: b.shared.length })}</Pill> : <Pill tone="idle">{t('Private')}</Pill>)}
        {b.links?.map((l, i) => <Pill key={i} tone="idle">↗ {l.label}</Pill>)}
      </span>
    </button>
  );
  return (
    <div className="wf-page">
      <PageHeader title={t('Sketches')} />
      <div className="wf-scroll"><div className="wf-body">
        <p className="text-xs text-ink-3">{t('Drawing boards built on Excalidraw. A board is yours alone until you share it. Others’ saved changes appear within a few seconds; it is not live side-by-side drawing yet.')}</p>
        {!isGuest && (
          <div className="flex flex-wrap items-end gap-2">
            <Field label={t('New board')}><Input value={name} placeholder={t('Name')} onChange={e => setName(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && name.trim()) create(); }} /></Field>
            <Button variant="primary" disabled={!name.trim() || offline} onClick={create}>+ {t('Create board')}</Button>
          </div>
        )}
        {boards === null ? <p className="text-sm text-ink-3">{t('Loading…')}</p> : boards.length === 0 ? (
          <Empty title={t('No boards yet')}>{isGuest ? t('Nothing has been shared with you yet.') : t('Create one to sketch a line layout, a shift plan or an idea.')}</Empty>
        ) : (
          <>
            {mine.length > 0 && <section><h2 className="mb-2 text-sm font-semibold">{t('My boards')}</h2><div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))' }}>{mine.map(card)}</div></section>}
            {shared.length > 0 && <section><h2 className="mb-2 text-sm font-semibold">{t('Shared with me')}</h2><div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))' }}>{shared.map(card)}</div></section>}
          </>
        )}
      </div></div>
    </div>
  );
}

function Board({ id, info, onBack, refresh }) {
  const { t, fmt, lang } = useI18n();
  const toast = useToast();
  const { wf, offline } = useWorkforce();
  const [board, setBoard] = useState(null);
  const [missing, setMissing] = useState(false);
  const [status, setStatus] = useState('saved'); // saved | dirty | saving | conflict | error
  const [sharing, setSharing] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [remoteScene, setRemoteScene] = useState(null);
  const rev = useRef(0);
  const pending = useRef(null);
  const timer = useRef(null);
  const wrap = useRef(null);

  useEffect(() => {
    let live = true;
    api('GET', `/api/sketches/${id}`).then(r => {
      if (!live) return;
      if (r.ok) { rev.current = r.data.rev; setBoard(r.data); } else setMissing(true);
    }).catch(() => { if (live) setMissing(true); });
    return () => { live = false; clearTimeout(timer.current); };
  }, [id]);

  const save = useCallback(async () => {
    const scene = pending.current;
    if (!scene) return;
    pending.current = null;
    setStatus('saving');
    const r = await api('PUT', `/api/sketches/${id}`, { scene, baseRev: rev.current }).catch(() => ({ ok: false, status: 0, data: {} }));
    if (r.ok) { rev.current = r.data.rev; setStatus(pending.current ? 'dirty' : 'saved'); }
    else if (r.status === 409) { pending.current = scene; setStatus('conflict'); }
    else { pending.current = pending.current || scene; setStatus('error'); if (r.status === 413) toast(t('The drawing is too large to save. Remove some images.')); }
  }, [id, toast, t]);

  const onScene = useCallback(scene => {
    pending.current = scene;
    setStatus(s => (s === 'conflict' ? s : 'dirty'));
    clearTimeout(timer.current);
    timer.current = setTimeout(() => { if (status !== 'conflict') save(); }, 1500);
  }, [save, status]);

  // Others' saves: look every few seconds, and load them when I have nothing unsaved.
  useEffect(() => {
    const tick = async () => {
      if (document.visibilityState !== 'visible' || pending.current || status === 'saving' || status === 'conflict') return;
      const boards = await refresh();
      const meta = boards?.find(b => b.id === id);
      if (meta && meta.rev > rev.current && !pending.current) {
        const r = await api('GET', `/api/sketches/${id}`);
        if (r.ok && !pending.current) { rev.current = r.data.rev; setRemoteScene({ scene: r.data.scene, at: Date.now() }); setBoard(b => ({ ...b, ...r.data })); }
      }
    };
    const iv = setInterval(tick, 6000);
    return () => clearInterval(iv);
  }, [id, refresh, status]);

  // Leaving with unsaved strokes: save them first.
  useEffect(() => () => { if (pending.current) save(); }, [save]);

  const loadTheirs = async () => {
    const r = await api('GET', `/api/sketches/${id}`);
    if (r.ok) { pending.current = null; rev.current = r.data.rev; setRemoteScene({ scene: r.data.scene, at: Date.now() }); setStatus('saved'); }
  };
  const keepMineAsCopy = async () => {
    const scene = pending.current;
    const r = await api('POST', '/api/sketches', { name: `${board.name} (${t('my copy')})` });
    if (r.ok) { await api('PUT', `/api/sketches/${r.data.id}`, { scene, baseRev: 1 }); toast(t('Your version was saved as a separate board.')); await loadTheirs(); }
  };
  const update = async patch => {
    const r = await api('PUT', `/api/sketches/${id}`, patch);
    if (r.ok) { rev.current = r.data.rev; setBoard(b => ({ ...b, ...r.data })); return true; }
    toast(r.data.error || t('That could not be saved: {why}', { why: r.status }));
    return false;
  };

  if (missing) return <div className="wf-page"><PageHeader title={t('Sketches')}><Button onClick={onBack}>← {t('All boards')}</Button></PageHeader><Empty title={t('This board doesn’t exist, or it hasn’t been shared with you')} /></div>;
  if (!board) return <div className="wf-page"><PageHeader title={t('Sketches')} /><p className="p-4 text-sm text-ink-3">{t('Loading…')}</p></div>;

  const statusText = { saved: t('Saved'), dirty: t('Unsaved changes…'), saving: t('Saving…'), conflict: t('Newer version exists'), error: t('Not saved') }[status];
  return (
    <div className="wf-page" ref={wrap}>
      <div className="wf-pagehead no-print">
        <Button onClick={onBack} aria-label={t('All boards')}>←</Button>
        {board.mine
          ? <input className="ui-input min-w-0 flex-1 font-semibold" defaultValue={board.name} aria-label={t('Board name')} onBlur={e => { const v = e.target.value.trim(); if (v && v !== board.name) update({ name: v }); }} onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); }} />
          : <strong className="min-w-0 flex-1 truncate">{board.name} <span className="font-normal text-ink-3">· {board.owner}</span></strong>}
        <Pill tone={status === 'saved' ? 'ok' : status === 'conflict' || status === 'error' ? 'bad' : 'idle'} role="status">{offline ? t('Offline') : statusText}</Pill>
        {board.mine && <Button onClick={() => setSharing(true)}>{board.shared?.length ? t('Shared with {n}', { n: board.shared.length }) : t('Share')}</Button>}
        <Button icon aria-label={t('Full screen')} title={t('Full screen')} onClick={() => (document.fullscreenElement ? document.exitFullscreen() : wrap.current?.requestFullscreen?.())}>⤢</Button>
        {board.mine && <Button variant="ghost" icon aria-label={t('Remove')} onClick={() => setRemoving(true)}>🗑</Button>}
      </div>
      {status === 'conflict' && (
        <div className="wf-banner" role="alert">
          {t('Someone else saved this board while you were drawing. Nothing has been overwritten.')}
          <span className="flex-1" />
          <Button onClick={loadTheirs}>{t('Load their version')}</Button>
          <Button onClick={keepMineAsCopy}>{t('Keep mine as a copy')}</Button>
        </div>
      )}
      <div className="min-h-0 flex-1" style={{ position: 'relative' }}>
        <Suspense fallback={<p className="p-4 text-sm text-ink-3">{t('Loading the drawing tool…')}</p>}>
          <Editor initial={board.scene} remote={remoteScene} onScene={onScene} readOnly={offline} lang={lang} />
        </Suspense>
      </div>
      {sharing && <ShareSheet board={board} info={info} onClose={() => setSharing(false)} onSave={update} wf={wf} fmt={fmt} />}
      {removing && <Confirm danger title={t('Remove this board?')} body={t('“{name}” and its drawing are removed for everyone it is shared with. This cannot be undone.', { name: board.name })} confirmLabel={t('Remove')} onCancel={() => setRemoving(false)}
        onConfirm={async () => { pending.current = null; await api('DELETE', `/api/sketches/${id}`); onBack(); }} />}
    </div>
  );
}

function ShareSheet({ board, info, onClose, onSave, wf }) {
  const { t } = useI18n();
  const [email, setEmail] = useState('');
  const [link, setLink] = useState({ kind: 'event', ref: '', label: '' });
  const shared = board.shared || [];
  const links = board.links || [];
  const events = list(wf.events);
  return (
    <Sheet title={t('Share “{name}”', { name: board.name })} onClose={onClose}>
      <div className="flex flex-col gap-5 text-sm">
        <section>
          <h3 className="mb-2 font-semibold">{t('People who can open and draw on this board')}</h3>
          {shared.length === 0 && <p className="text-ink-3">{t('Only you. Not even the admin can open it in the app.')}</p>}
          <ul className="flex flex-col gap-1">{shared.map(e => (
            <li key={e} className="flex items-center gap-2">{e}<span className="flex-1" /><Button variant="ghost" onClick={() => onSave({ shared: shared.filter(x => x !== e) })}>{t('Remove')}</Button></li>
          ))}</ul>
          <div className="mt-2 flex flex-wrap items-end gap-2">
            <Field label={t('Google account (email)')}><Input type="email" value={email} onChange={e => setEmail(e.target.value)} /></Field>
            <Button variant="primary" disabled={!email.includes('@')} onClick={async () => { if (await onSave({ shared: [...shared, email] })) setEmail(''); }}>{t('Share')}</Button>
          </div>
          <p className="mt-2 text-xs text-ink-3">
            {info.externalGuests
              ? t('People outside the workspace can be added: they sign in with Google and see only the boards shared with them.')
              : t('Only people who already have access to the workspace can be added. The admin can allow outside guests under Access.')}
            {' '}{t('No email is sent from here: send them the link yourself.')}
          </p>
        </section>
        <section>
          <h3 className="mb-2 font-semibold">{t('Links')}</h3>
          <ul className="flex flex-col gap-1">{links.map((l, i) => (
            <li key={i} className="flex items-center gap-2">↗ {l.kind === 'url' ? <a className="underline" href={l.ref} target="_blank" rel="noreferrer">{l.label}</a> : l.label}<span className="flex-1" /><Button variant="ghost" onClick={() => onSave({ links: links.filter((_, k) => k !== i) })}>{t('Remove')}</Button></li>
          ))}</ul>
          <div className="mt-2 flex flex-wrap items-end gap-2">
            <Field label={t('Link to')}>
              <Select value={link.kind} onChange={e => setLink({ kind: e.target.value, ref: '', label: '' })}>
                <option value="event">{t('A calendar activity')}</option><option value="url">{t('A work item or page (web address)')}</option>
              </Select>
            </Field>
            {link.kind === 'event'
              ? <Field label={t('Activity')}><Select value={link.ref} onChange={e => setLink({ ...link, ref: e.target.value, label: events.find(x => x.id === e.target.value)?.title || '' })}><option value="">{t('Choose…')}</option>{events.map(ev => <option key={ev.id} value={ev.id}>{ev.title}</option>)}</Select></Field>
              : <><Field label={t('Web address')}><Input value={link.ref} placeholder="https://" onChange={e => setLink({ ...link, ref: e.target.value })} /></Field><Field label={t('Label')}><Input value={link.label} onChange={e => setLink({ ...link, label: e.target.value })} /></Field></>}
            <Button disabled={!link.ref || !link.label || (link.kind === 'url' && !/^https?:\/\//.test(link.ref))} onClick={async () => { if (await onSave({ links: [...links, link] })) setLink({ kind: link.kind, ref: '', label: '' }); }}>{t('Add link')}</Button>
          </div>
        </section>
      </div>
    </Sheet>
  );
}
