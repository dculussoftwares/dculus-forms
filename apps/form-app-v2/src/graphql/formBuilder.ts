/**
 * GraphQL Queries and Mutations for Collaborative Form Builder
 * 
 * These queries fetch form metadata needed for the builder.
 * Form schema (pages, fields, layout) is managed through YJS for real-time collaboration.
 */

import { gql } from '@apollo/client';

/**
 * Query to fetch form data for the builder
 * Returns form metadata including title, permissions, and organization
 */
export const GET_FORM_BY_ID = gql`
  query GetFormById($id: ID!) {
    form(id: $id) {
      id
      title
      shortUrl
      userPermission
      organization {
        id
        name
      }
      createdAt
      updatedAt
    }
  }
`;

/**
 * Mutation to update form title
 * Used when user renames the form in the builder header
 */
export const UPDATE_FORM_TITLE = gql`
  mutation UpdateFormTitle($id: ID!, $title: String!) {
    updateForm(id: $id, input: { title: $title }) {
      id
      title
      updatedAt
    }
  }
`;

/**
 * Mutation to publish/unpublish the form
 * Used to toggle form visibility to respondents
 */
export const TOGGLE_FORM_PUBLISH = gql`
  mutation ToggleFormPublish($id: ID!, $isPublished: Boolean!) {
    updateForm(id: $id, input: { isPublished: $isPublished }) {
      id
      isPublished
      updatedAt
    }
  }
`;
