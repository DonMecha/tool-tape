import type { Register } from 'claude-code'

// Lays out each tool call of the current turn as one colored cell above the prompt,
// with the call count, elapsed time and a per-kind breakdown, and adds the call
// count and the latest tool to the spinner.

type Kind = 'read' | 'run' | 'edit' | 'web' | 'agent' | 'other'
type Pip = { kind: Kind; failed: boolean }
type Lang = 'en' | 'ja'

const COLORS: Record<Kind, string> = {
  read: '#5fb3d9',
  run: '#e5c07b',
  edit: '#98c379',
  web: '#61afef',
  agent: '#c678dd',
  other: '#7f848e',
}
const FAILED = '#e06c75'
const TAPE_MAX = 40

const TEXT = {
  en: {
    kinds: { read: 'read ', run: 'run ', edit: 'edit ', web: 'web ', agent: 'agent ', other: 'other ' },
    failed: 'failed ',
    running: 'Running ',
    last: 'Last ',
    calls: (n: number) => `${n} ${n === 1 ? 'call' : 'calls'}`,
    nth: (n: number) => `call ${n}`,
    time: (m: number, s: number) => (m === 0 ? `${s}s` : `${m}m ${s}s`),
  },
  ja: {
    kinds: { read: '読', run: '実', edit: '編', web: '網', agent: '委', other: '他' },
    failed: '失',
    running: '進行 ',
    last: '前回 ',
    calls: (n: number) => `${n}回`,
    nth: (n: number) => `${n}回目`,
    time: (m: number, s: number) => (m === 0 ? `${s}秒` : `${m}分${s}秒`),
  },
} as const

const kindOf = (tool: string): Kind => {
  if (['Read', 'Grep', 'Glob', 'LS', 'NotebookRead'].includes(tool)) return 'read'
  if (['Bash', 'BashOutput', 'KillShell', 'Monitor'].includes(tool)) return 'run'
  if (['Edit', 'Write', 'MultiEdit', 'NotebookEdit'].includes(tool)) return 'edit'
  if (['WebFetch', 'WebSearch'].includes(tool) || tool.startsWith('mcp__playwright__')) return 'web'
  if (['Agent', 'Task', 'SendMessage'].includes(tool)) return 'agent'
  return 'other'
}

const shortName = (tool: string) => (tool.startsWith('mcp__') ? tool.split('__').pop() ?? tool : tool)

const pickLang = (setting: unknown, locale: string | undefined): Lang => {
  if (setting === 'en' || setting === 'ja') return setting
  return locale?.toLowerCase().startsWith('ja') ? 'ja' : 'en'
}

export const register: Register = (on, options) => {
  let lang: Lang = pickLang(options.language, undefined)
  let pips: Pip[] = []
  let lastTool = ''
  let started = false
  let startedAt = 0
  let endedAt = 0
  let working = false
  let tick: { cancel: () => void } | undefined

  on('session.start', async ($, e, next) => {
    if (options.language !== 'en' && options.language !== 'ja') {
      const locale = (await $.env.get('LC_ALL')) || (await $.env.get('LC_MESSAGES')) || (await $.env.get('LANG'))
      lang = pickLang(options.language, locale)
    }
    return next(e)
  })

  on('prompt.submit', async ($, e, next) => {
    pips = []
    lastTool = ''
    startedAt = await $.clock.now()
    started = true
    endedAt = 0
    working = true
    tick?.cancel()
    tick = $.clock.every(1000, () => $.ui.invalidate('ui.render'))
    $.ui.invalidate('ui.render')
    return next(e)
  }).catch(($, e, next) => next(e))

  on('tool.call', async ($, e, next) => {
    const pip: Pip = { kind: kindOf(e.tool), failed: false }
    pips.push(pip)
    lastTool = shortName(e.tool)
    $.ui.invalidate('ui.render')
    const ran = await next(e)
    if (ran.deny !== undefined || ran.isError === true) {
      pip.failed = true
      $.ui.invalidate('ui.render')
    }
    return ran
  }).catch(($, e, next) => next(e))

  on('turn.complete', async ($, e, next) => {
    endedAt = await $.clock.now()
    working = false
    tick?.cancel()
    tick = undefined
    $.ui.invalidate('ui.render')
    return next(e)
  })

  on('ui.render', { component: 'Spinner' }, ($, e, next) =>
    pips.length === 0
      ? next(e)
      : next({ ...e, props: { ...e.props, suffix: `… ${TEXT[lang].nth(pips.length)} · ${lastTool}` } }),
  )

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (e.props.hasSurvey || !started) return next(e)

    const t = TEXT[lang]
    const { Box, Text } = $.ui.resolve(e)
    const sec = Math.round(((working ? await $.clock.now() : endedAt) - startedAt) / 1000)
    const shown = pips.slice(-TAPE_MAX)
    const hidden = pips.length - shown.length
    const failed = pips.filter(p => p.failed).length
    const counts = (Object.keys(COLORS) as Kind[])
      .map(kind => ({ kind, n: pips.filter(p => p.kind === kind).length }))
      .filter(c => c.n > 0)

    return (
      <Box flexDirection="row">
        <Text dimColor>{working ? t.running : t.last}</Text>
        {hidden > 0 ? <Text dimColor>+{hidden} </Text> : null}
        {shown.map(p => (
          <Text backgroundColor={p.failed ? FAILED : COLORS[p.kind]}> </Text>
        ))}
        {shown.length > 0 ? <Text> </Text> : null}
        <Text dimColor>
          {t.calls(pips.length)} · {t.time(Math.floor(sec / 60), sec % 60)}
        </Text>
        {counts.map(c => (
          <Text color={COLORS[c.kind]}>
            {'  '}
            {t.kinds[c.kind]}
            {c.n}
          </Text>
        ))}
        {failed > 0 ? <Text color={FAILED}>{'  '}{t.failed}{failed}</Text> : null}
      </Box>
    )
  })
}
