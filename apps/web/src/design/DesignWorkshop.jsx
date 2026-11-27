import { useState } from 'react';
import { Segmented, ToastProvider } from '../ui';
import { loadTheme } from '../theme/theme.js';
import WorkshopSection from './WorkshopSection.jsx';
import ColorSection from './ColorSection.jsx';
import TypeSection from './TypeSection.jsx';
import SpaceSection from './SpaceSection.jsx';
import Playground from './Playground.jsx';
import ExampleDashboard from './ExampleDashboard.jsx';
import './design.css';

const THEMES = [
  { value: 'calm', label: 'Calm' },
  { value: 'arcade', label: 'Arcade' },
  { value: 'night', label: 'Night shift' },
];
const SECTIONS = [
  { id: 'dw-colors', label: 'Colours' },
  { id: 'dw-type', label: 'Type' },
  { id: 'dw-space', label: 'Spacing' },
  { id: 'dw-components', label: 'Components' },
  { id: 'dw-example', label: 'Example' },
];

/* Design workshop (#/design, not in the menu): the design system's tokens
 * and shared controls, live and in any theme, ending in a working example
 * page. Switching theme here doesn't change the app's own theme. */
export default function DesignWorkshop() {
  const [theme, setTheme] = useState(loadTheme);
  const jump = id => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });

  return (
    <div data-theme={theme} className="dw wf-page">
      <ToastProvider>
        <div className="dw-top">
          <div className="dw-inner dw-top__row">
            <div>
              <p className="t-label">Master design system</p>
              <h1 className="t-title">Design workshop</h1>
            </div>
            <Segmented label="Theme" value={theme} onChange={setTheme} options={THEMES} />
          </div>
          <nav className="dw-inner dw-nav" aria-label="Sections">
            {SECTIONS.map((s, i) => (
              <button key={s.id} type="button" className="dw-chip ui-focus" onClick={() => jump(s.id)}>
                <span className="t-num">{i + 1}</span> {s.label}
              </button>
            ))}
          </nav>
        </div>

        <main className="dw-inner dw-main">
          <WorkshopSection id="dw-colors" step={1} title="Colours" intro="Every colour token in this theme, read from tokens.css. Click one to copy its variable.">
            <ColorSection theme={theme} />
          </WorkshopSection>
          <WorkshopSection id="dw-type" step={2} title="Typography" intro="Four steps, set by class. The display face changes with the theme.">
            <TypeSection />
          </WorkshopSection>
          <WorkshopSection id="dw-space" step={3} title="Spacing, corners and depth" intro="A 4px base and three radii. Corners are soft in Calm, square in Arcade, round in Night shift.">
            <SpaceSection />
          </WorkshopSection>
          <WorkshopSection id="dw-components" step={4} title="Components" intro="The shared controls from src/ui. Change the knobs; the code underneath follows.">
            <Playground />
          </WorkshopSection>
          <WorkshopSection id="dw-example" step={5} title="Example page" intro="A shift dashboard built only from these pieces. It works: cover the gap, tick, add and delete tasks (with Undo). Nothing is saved.">
            <ExampleDashboard />
          </WorkshopSection>
        </main>
      </ToastProvider>
    </div>
  );
}
