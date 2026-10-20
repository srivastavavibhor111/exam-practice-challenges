import { StrictMode } from 'react';
import { render, screen, act, cleanup } from '@testing-library/react';
import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';
import { useBackNavigationGuard } from './guard.js';

const tick = (ms = 30) => new Promise(r => setTimeout(r, ms));
let api;
function Where() { return <div data-testid="loc">{useLocation().pathname}</div>; }
function TestPage({ enabled }) {
  api = useBackNavigationGuard({ enabled, exitTo: '/my-tests' });
  return <div data-testid="open">{String(api.isDialogOpen)}</div>;
}
function App({ enabled = true, strict = false }) {
  const tree = (
    <BrowserRouter>
      <Where />
      <Routes>
        <Route path="/test/:id" element={<TestPage enabled={enabled} />} />
        <Route path="/my-tests" element={<div>my tests</div>} />
        <Route path="/prev" element={<div>prev</div>} />
      </Routes>
    </BrowserRouter>
  );
  return strict ? <StrictMode>{tree}</StrictMode> : tree;
}
const open = () => screen.getByTestId('open').textContent;
const loc  = () => screen.getByTestId('loc').textContent;

beforeEach(() => { cleanup(); window.history.replaceState(null, '', '/prev'); });

async function startOnTest(props) {
  window.history.pushState(null, '', '/test/abc');   // arrive from /prev
  const r = render(<App {...props} />);
  await tick();
  return r;
}

test('adds exactly one sentinel, even under StrictMode', async () => {
  const before = window.history.length;
  await startOnTest({ strict: true });
  expect(window.history.length).toBe(before + 2); // test entry + ONE sentinel
});

test('Back opens ONE dialog, stays on the test URL, restores the sentinel', async () => {
  await startOnTest({});
  const len = window.history.length;
  await act(async () => { window.history.back(); await tick(); });
  expect(open()).toBe('true');
  expect(loc()).toBe('/test/abc');
  expect(window.history.state.__epcTestGuard).toBe(true);
  expect(window.history.length).toBe(len);          // no growth → no loop
});

test('repeated Back while open keeps a single dialog; Continue closes; Back works again', async () => {
  await startOnTest({});
  for (let i = 0; i < 3; i++) await act(async () => { window.history.back(); await tick(); });
  expect(open()).toBe('true');
  expect(loc()).toBe('/test/abc');
  act(() => api.continueTest());
  expect(open()).toBe('false');
  await act(async () => { window.history.back(); await tick(); });
  expect(open()).toBe('true');
});

test('Exit Test leaves to exitTo and drops the test entries (Back goes to /prev)', async () => {
  await startOnTest({});
  await act(async () => { window.history.back(); await tick(); });
  await act(async () => { api.confirmExit(); await tick(400); });
  expect(loc()).toBe('/my-tests');
  await act(async () => { window.history.back(); await tick(); });
  expect(loc()).toBe('/prev');
});

test('Exit via requestExit (button path) opens the same dialog', async () => {
  await startOnTest({});
  act(() => api.requestExit());
  expect(open()).toBe('true');
});

test('disabled guard: no sentinel, no dialog, Back behaves normally', async () => {
  window.history.pushState(null, '', '/test/abc');
  const before = window.history.length;
  render(<App enabled={false} />); await tick();
  expect(window.history.length).toBe(before);
  await act(async () => { window.history.back(); await tick(); });
  expect(loc()).toBe('/prev');
});

test('turning the guard off (submit) removes the listener and closes the dialog', async () => {
  const { rerender } = await startOnTest({});
  await act(async () => { window.history.back(); await tick(); });
  expect(open()).toBe('true');
  rerender(<App enabled={false} />); await tick();
  expect(open()).toBe('false');
});

test('navigateAway replaces the sentinel (history shape unchanged vs before feature)', async () => {
  await startOnTest({});
  const len = window.history.length;
  await act(async () => { api.navigateAway('/my-tests'); await tick(); });
  expect(loc()).toBe('/my-tests');
  expect(window.history.length).toBe(len);          // replaced, not pushed
});

test('multi-step jump to another URL does not push entries onto that page', async () => {
  await startOnTest({});
  const len = window.history.length;
  await act(async () => { window.history.go(-2); await tick(50); });
  expect(loc()).toBe('/prev');
  expect(window.history.length).toBe(len);
  expect(window.history.state?.__epcTestGuard).not.toBe(true);
});
