import { expect, mock, test } from 'claude-code/testing'
import type { Engine } from 'claude-code/testing'
import type { On } from 'claude-code'

const BAND = {
  component: 'AbovePrompt',
  props: { hasSurvey: false, isWorking: true, maxRows: 10, bodyColumns: 120, scroll: { offset: 0, bodyRows: 10 }, view: {} },
} as const

const beneath = (on: On) => {
  on('session.start', async (_, e) => ({ cwd: e.cwd }))
  on('prompt.submit', async (_, e) => ({ text: e.text }))
  on('ui.render', ($, e) => $.ui.resolve(e).Box({ children: [] }))
  on('tool.call', async (_, e) =>
    e.tool === 'Bash' ? { result: { stdout: '', stderr: 'boom', interrupted: false }, isError: true } : { result: {} },
  )
}

const turn = async ($: Engine, clock: { advance: (ms: number) => Promise<void> }) => {
  await $.prompt.submit({ text: 'go', wait: false, origin: { kind: 'composer' } })
  await $.tool.call({ tool: 'Read', file_path: '/a' })
  await $.tool.call({ tool: 'Read', file_path: '/b' })
  await $.tool.call({ tool: 'Bash', command: 'false' })
  await clock.advance(65_000)
}

test('counts calls by kind and failures separately (en)', { options: { language: 'en' } }, async ($, on) => {
  const clock = mock.clock(on)
  beneath(on)
  await turn($, clock)

  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ plugin: 'tool-tape', surface, ...BAND })
    expect(await ui.find({ type: 'Text', text: '3 calls · 1m 5s' })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: 'read 2' })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: 'run 1' })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: 'failed 1' })).toBeDefined()
    await ui.unmount()
  }
})

test('follows LANG when language is auto', async ($, on) => {
  const clock = mock.clock(on)
  mock.env(on, { LANG: 'ja_JP.UTF-8' })
  beneath(on)
  await $.session.start({ cwd: '/work', surface: 'terminal', isInteractive: true })
  await turn($, clock)

  const ui = await $.ui.mount({ plugin: 'tool-tape', surface: 'terminal', ...BAND })
  expect(await ui.find({ type: 'Text', text: '3回 · 1分5秒' })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: '読2' })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: '失1' })).toBeDefined()
  await ui.unmount()
})

test('draws nothing before the first turn', async ($, on) => {
  mock.clock(on)
  beneath(on)
  const ui = await $.ui.mount({ plugin: 'tool-tape', surface: 'terminal', ...BAND })
  expect(await ui.find({ type: 'Text', text: /calls/ })).toBeUndefined()
  await ui.unmount()
})
