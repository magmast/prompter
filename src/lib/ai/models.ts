export interface Model {
  id: string;
  label: string;
  apiIdentifier: string;
  description: string;
}

export const models: Array<Model> = [
  {
    id: "openai/gpt-4o-mini",
    label: "GPT-4o Mini",
    apiIdentifier: "openai/gpt-4o-mini",
    description: "OpenAI's GPT-4o Mini model",
  },
  {
    id: "openai/gpt-4o",
    label: "GPT-4o",
    apiIdentifier: "openai/gpt-4o",
    description: "OpenAI's GPT-4o model",
  },
  {
    id: "deepseek/deepseek-chat",
    label: "DeepSeek V3",
    apiIdentifier: "deepseek/deepseek-chat",
    description:
      "Large Mixture-of-Experts model for state-of-the-art performance across diverse tasks",
  },
] as const;

export const DEFAULT_MODEL_NAME: string = "openai/gpt-4o-mini";
