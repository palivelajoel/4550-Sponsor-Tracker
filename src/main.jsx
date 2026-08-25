import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import Admin from './Admin.jsx'
import Landing from './Landing.jsx'
import Hub from './Hub.jsx'
import HubCalendar from './HubCalendar.jsx'
import HubTasks from './HubTasks.jsx'
import HubMedia from './HubMedia.jsx'
import HubAnnouncements from './HubAnnouncements.jsx'
import HubResources from './HubResources.jsx'
import HubProjector from './HubProjector.jsx'
import HubInventory from './HubInventory.jsx'
import HubForms from './HubForms.jsx'
import PublicFormFill from './PublicFormFill.jsx'
import PublicMedia from './PublicMedia.jsx'
import Privacy from './Privacy.jsx'
import Terms from './Terms.jsx'
import HubArticles from './HubArticles.jsx'
import ArticleView from './ArticleView.jsx'

const path = window.location.pathname

const Page =
  path === '/admin'                            ? Admin
  : path.startsWith('/forms/')                  ? PublicFormFill
  : path === '/member-hub/sponsors'              ? App
  : path === '/member-hub'                     ? Hub
  : path === '/member-hub/calendar'            ? HubCalendar
  : path === '/member-hub/tasks'               ? HubTasks
  : path === '/member-hub/media'               ? HubMedia
  : path === '/member-hub/announcements'       ? HubAnnouncements
  : path === '/member-hub/resources'           ? HubResources
  : path === '/member-hub/projector'           ? HubProjector
  : path === '/member-hub/forms'               ? HubForms
  : path === '/member-hub/inventory'           ? HubInventory
  : path === '/member-hub/articles'            ? HubArticles
  : path === '/article'                        ? ArticleView
  : path === '/media'                          ? PublicMedia
  : path === '/privacy'                        ? Privacy
  : path === '/terms'                          ? Terms
  : Landing

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <Page />
  </StrictMode>
)
