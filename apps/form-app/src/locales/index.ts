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
import enAddFieldPopover from './en/addFieldPopover.json';
import enPermissions from './en/permissions.json';
import enPageSelector from './en/pageSelector.json';
import enPageThumbnailsSidebar from './en/pageThumbnailsSidebar.json';
import enEmptyStates from './en/emptyStates.json';
import enConfirmationDialog from './en/confirmationDialog.json';
import enSettingsTab from './en/settingsTab.json';
import enPageBuilderTab from './en/pageBuilderTab.json';
import enFieldSettingsHeader from './en/fieldSettingsHeader.json';
import enFieldSettingsConstants from './en/fieldSettingsConstants.json';
import enCollaborationStatus from './en/collaborationStatus.json';
import enBackgroundImage from './en/backgroundImage.json';
import enLayoutOptions from './en/layoutOptions.json';
import enLayoutThumbnails from './en/layoutThumbnails.json';
import enHeader from './en/header.json';
import enCreateFormPopover from './en/createFormPopover.json';
import enUserProfileMenu from './en/userProfileMenu.json';
import enNavMain from './en/navMain.json';
import enTeamSwitcher from './en/teamSwitcher.json';
import enNavUser from './en/navUser.json';
import enAppSidebar from './en/appSidebar.json';
import enUpgradeModal from './en/upgradeModal.json';

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
    addFieldPopover: enAddFieldPopover,
    permissions: enPermissions,
    pageSelector: enPageSelector,
    pageThumbnailsSidebar: enPageThumbnailsSidebar,
    emptyStates: enEmptyStates,
    confirmationDialog: enConfirmationDialog,
    settingsTab: enSettingsTab,
    pageBuilderTab: enPageBuilderTab,
    fieldSettingsHeader: enFieldSettingsHeader,
    fieldSettingsConstants: enFieldSettingsConstants,
    collaborationStatus: enCollaborationStatus,
    backgroundImage: enBackgroundImage,
    layoutOptions: enLayoutOptions,
    layoutThumbnails: enLayoutThumbnails,
    header: enHeader,
    createFormPopover: enCreateFormPopover,
    userProfileMenu: enUserProfileMenu,
    navMain: enNavMain,
    teamSwitcher: enTeamSwitcher,
    navUser: enNavUser,
    appSidebar: enAppSidebar,
    upgradeModal: enUpgradeModal,
  },
} as const;

export type Translations = typeof translations;
export type Locale = keyof Translations;
export type LocaleMessages = Translations[Locale];
export type Namespace = keyof LocaleMessages;

export const defaultLocale: Locale = 'en';

export const availableLocales = Object.keys(translations) as Locale[];
