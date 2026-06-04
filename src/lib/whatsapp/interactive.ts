export interface InteractiveButton {
  id: string
  title: string
}

export interface InteractiveListRow {
  id: string
  title: string
  description?: string
}

export interface InteractiveListSection {
  title: string
  rows: InteractiveListRow[]
}

export function buildButtonMessage(
  body: string,
  buttons: InteractiveButton[]
) {
  return {
    type: 'button',
    body: { text: body },
    action: {
      buttons: buttons.map((b) => ({
        type: 'reply',
        reply: { id: b.id, title: b.title },
      })),
    },
  }
}

export function buildListMessage(
  body: string,
  buttonText: string,
  sections: InteractiveListSection[]
) {
  return {
    type: 'list',
    body: { text: body },
    action: {
      button: buttonText,
      sections,
    },
  }
}
