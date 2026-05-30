import { gql } from '@apollo/client';

export const AI_MODEL_CONFIGS_QUERY = gql`
  query AIModelConfigs {
    aiModelConfigs {
      id
      plan
      primaryModel
      fastModel
      updatedAt
      updatedBy
    }
    aiSupportedModels {
      id
      label
    }
  }
`;

export const UPDATE_AI_MODEL_CONFIG_MUTATION = gql`
  mutation UpdateAIModelConfig($plan: String!, $primaryModel: String!, $fastModel: String!) {
    updateAIModelConfig(plan: $plan, primaryModel: $primaryModel, fastModel: $fastModel) {
      id
      plan
      primaryModel
      fastModel
      updatedAt
    }
  }
`;
