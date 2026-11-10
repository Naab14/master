/* The Excalidraw editor itself (https://github.com/excalidraw/excalidraw,
 * MIT). Loaded only when a board is opened: it is a large bundle. */
import { useEffect, useRef, useState } from 'react';
import { Excalidraw, getSceneVersion } from '@excalidraw/excalidraw';
import '@excalidraw/excalidraw/index.css';

// Fonts are served from this site (see scripts/copy-excalidraw-assets.mjs).
window.EXCALIDRAW_ASSET_PATH = '/excalidraw/';

const LANG = { sv: 'sv-SE', en: 'en' };

export default function SketchEditor({ initial, remote, onScene, readOnly, lang }) {
  const [api, setApi] = useState(null);
  const version = useRef(initial?.elements ? getSceneVersion(initial.elements) : 0);
  const dark = ['arcade', 'night'].includes(document.documentElement.getAttribute('data-theme'));

  // A newer version saved by someone else: show it.
  useEffect(() => {
    if (!api || !remote) return;
    const elements = remote.scene?.elements || [];
    version.current = getSceneVersion(elements);
    if (remote.scene?.files) api.addFiles(Object.values(remote.scene.files));
    api.updateScene({ elements, appState: { viewBackgroundColor: remote.scene?.appState?.viewBackgroundColor } });
  }, [api, remote]);

  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      <Excalidraw
        excalidrawAPI={setApi}
        initialData={{ elements: initial?.elements || [], appState: { viewBackgroundColor: initial?.appState?.viewBackgroundColor }, files: initial?.files || {}, scrollToContent: true }}
        viewModeEnabled={readOnly}
        theme={dark ? 'dark' : 'light'}
        langCode={LANG[lang] || 'en'}
        onChange={(elements, appState, files) => {
          // onChange also fires for pointer moves; only real edits are saved.
          const v = getSceneVersion(elements);
          if (v === version.current) return;
          version.current = v;
          onScene({ elements: elements.filter(e => !e.isDeleted), appState: { viewBackgroundColor: appState.viewBackgroundColor }, files });
        }}
      />
    </div>
  );
}
