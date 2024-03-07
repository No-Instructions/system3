import * as Diff from 'diff'

type YDelta = { retain: number }
  | { delete: number }
  | { insert: string }

export const getDeltaOperations = (initialText: string, finalText: string): YDelta[] => {
  if (initialText === finalText) {
    return []
  }

  const edits = Diff.diffChars(initialText, finalText)
  let prevOffset = 0
  let deltas: YDelta[] = []

  // Map the edits onto Yjs delta operations
  for (const edit of edits) {
    if (edit.removed && edit.value) {
      deltas = [
        ...deltas,
        ...[
          ...(prevOffset > 0 ? [{ retain: prevOffset }] : []),
          { delete: edit.value.length }
        ]
      ]
      prevOffset = 0
    } else if (edit.added && edit.value) {
      deltas = [
          ...deltas,
          ...[{ retain: prevOffset }, { insert: edit.value }]
        ]
      prevOffset = edit.value.length
    } else {
      prevOffset = edit.value.length
    }
  }
  return deltas
}
