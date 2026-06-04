export interface AIMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface AIRequest {
  messages: AIMessage[]
  temperature?: number
  maxTokens?: number
  model?: string
  forceModel?: 'deepseek' | 'qwen'
}

export interface AIUsage {
  promptTokens: number
  completionTokens: number
}

export interface AIResponse {
  content: string
  model: string
  usage: AIUsage
}

export interface ModelRouterDecision {
  model: 'deepseek' | 'qwen'
  reason: 'forced' | 'high_complexity' | 'standard'
}

export interface EvalResult {
  score: number
  flags: string[]
  reasoning: string
}
