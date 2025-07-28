export const MODEL_OPTIONS = [
  { group: 'Amazon Nova', models: ['nova-lite', 'nova-pro'] },
  { group: 'Anthropic Claude', models: ['claude-3-7-sonnet', 'claude-sonnet-4'] }
] as const;

export const getModelDisplayName = (modelId: string): string => {
  switch (modelId) {
    case 'nova-lite': return 'Nova Lite';
    case 'nova-pro': return 'Nova Pro';
    case 'claude-3-7-sonnet': return 'Claude 3.7 Sonnet';
    case 'claude-sonnet-4': return 'Claude Sonnet 4';
    default: return modelId;
  }
};

export const getModelDescription = (modelId: string): string => {
  switch (modelId) {
    case 'nova-lite': return '低コスト、日常的なタスク';
    case 'nova-pro': return '低コスト、複雑な推論タスク';
    case 'claude-3-7-sonnet': return '中コスト、高度な推論能力';
    case 'claude-sonnet-4': return '高コスト、最上位モデル';
    default: return '';
  }
};