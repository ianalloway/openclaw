export const CHAT_VIEW_SETTINGS = [
  ["reasoning", "chatShowThinking", "chat.view.reasoning", false, true],
  ["tool-calls", "chatShowToolCalls", "chat.view.toolCalls", true, true],
  ["commentary", "chatPersistCommentary", "chat.view.commentary", undefined, true],
  ["inline-commands", "chatInlineCommands", "chat.view.inlineCommands", false, false],
] as const;
