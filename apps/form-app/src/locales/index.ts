import enCommon from './en/common.json';
import enSignIn from './en/signIn.json';
import enSignUp from './en/signUp.json';
import enForgotPassword from './en/forgotPassword.json';
import enSignInOtp from './en/signInOtp.json';
import enInviteAcceptance from './en/inviteAcceptance.json';
import enSettings from './en/settings.json';
import enFormsList from './en/formsList.json';
import enTemplates from './en/templates.json';
import enDashboard from './en/dashboard.json';
import enFormDashboard from './en/formDashboard.json';
import enSharing from './en/sharing.json';
import enResponses from './en/responses.json';
import enFormSettings from './en/formSettings.json';
import enFormAnalytics from './en/formAnalytics.json';
import enCollaborativeFormBuilder from './en/collaborativeFormBuilder.json';
import enPluginConfiguration from './en/pluginConfiguration.json';
import enResponsesAnalytics from './en/responsesAnalytics.json';
import enResponsesIndividual from './en/responsesIndividual.json';
import enResponseEditHistory from './en/responseEditHistory.json';
import enResponseEdit from './en/responseEdit.json';
import enPlugins from './en/plugins.json';
import enTabNavigation from './en/tabNavigation.json';
import enLayoutSidebar from './en/layoutSidebar.json';
import enFieldTypesPanel from './en/fieldTypesPanel.json';
import enDraggablePageItem from './en/draggablePageItem.json';
import enDraggableField from './en/draggableField.json';
import enPagesSidebar from './en/pagesSidebar.json';
import enFormBuilderHeader from './en/formBuilderHeader.json';
import enDroppablePage from './en/droppablePage.json';
import enFieldSettings from './en/fieldSettings.json';
import enPageThumbnail from './en/pageThumbnail.json';
import enPageCard from './en/pageCard.json';
import enContextualBreadcrumb from './en/contextualBreadcrumb.json';
import enFieldItem from './en/fieldItem.json';
import enPageActionsSelector from './en/pageActionsSelector.json';
import enLoadingState from './en/loadingState.json';
import enEmptyFormState from './en/emptyFormState.json';
import enEmptyDropZone from './en/emptyDropZone.json';
import enJsonPreview from './en/jsonPreview.json';

export const translations = {
  en: {
    common: enCommon,
    signIn: enSignIn,
    signUp: enSignUp,
    forgotPassword: enForgotPassword,
    signInOtp: enSignInOtp,
    inviteAcceptance: enInviteAcceptance,
    settings: enSettings,
    formsList: enFormsList,
    templates: enTemplates,
    dashboard: enDashboard,
    formDashboard: enFormDashboard,
    sharing: enSharing,
    responses: enResponses,
    formSettings: enFormSettings,
    formAnalytics: enFormAnalytics,
    collaborativeFormBuilder: enCollaborativeFormBuilder,
    pluginConfiguration: enPluginConfiguration,
    responsesAnalytics: enResponsesAnalytics,
    responsesIndividual: enResponsesIndividual,
    responseEditHistory: enResponseEditHistory,
    responseEdit: enResponseEdit,
    plugins: enPlugins,
    tabNavigation: enTabNavigation,
    layoutSidebar: enLayoutSidebar,
    fieldTypesPanel: enFieldTypesPanel,
    draggablePageItem: enDraggablePageItem,
    draggableField: enDraggableField,
    pagesSidebar: enPagesSidebar,
    formBuilderHeader: enFormBuilderHeader,
    droppablePage: enDroppablePage,
    fieldSettings: enFieldSettings,
    pageThumbnail: enPageThumbnail,
    pageCard: enPageCard,
    contextualBreadcrumb: enContextualBreadcrumb,
    fieldItem: enFieldItem,
    pageActionsSelector: enPageActionsSelector,
    loadingState: enLoadingState,
    emptyFormState: enEmptyFormState,
    emptyDropZone: enEmptyDropZone,
    jsonPreview: enJsonPreview,
  },
} as const;

export type Translations = typeof translations;
export type Locale = keyof Translations;
export type LocaleMessages = Translations[Locale];
export type Namespace = keyof LocaleMessages;

export const defaultLocale: Locale = 'en';

export const availableLocales = Object.keys(translations) as Locale[];
