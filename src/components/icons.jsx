import AlertTriangle from 'lucide-react/dist/esm/icons/alert-triangle.js'
import ArrowDownUp from 'lucide-react/dist/esm/icons/arrow-down-up.js'
import BarChart3 from 'lucide-react/dist/esm/icons/bar-chart-3.js'
import ChevronDown from 'lucide-react/dist/esm/icons/chevron-down.js'
import Boxes from 'lucide-react/dist/esm/icons/boxes.js'
import CircleDollarSign from 'lucide-react/dist/esm/icons/circle-dollar-sign.js'
import BellRing from 'lucide-react/dist/esm/icons/bell-ring.js'
import ClipboardList from 'lucide-react/dist/esm/icons/clipboard-list.js'
import History from 'lucide-react/dist/esm/icons/history.js'
import LayoutDashboard from 'lucide-react/dist/esm/icons/layout-dashboard.js'
import LogIn from 'lucide-react/dist/esm/icons/log-in.js'
import LogOut from 'lucide-react/dist/esm/icons/log-out.js'
import Maximize2 from 'lucide-react/dist/esm/icons/maximize-2.js'
import PenSquare from 'lucide-react/dist/esm/icons/pen-square.js'
import PieChart from 'lucide-react/dist/esm/icons/pie-chart.js'
import Shield from 'lucide-react/dist/esm/icons/shield.js'
import ShoppingCart from 'lucide-react/dist/esm/icons/shopping-cart.js'
import TrendingUp from 'lucide-react/dist/esm/icons/trending-up.js'
import Users from 'lucide-react/dist/esm/icons/users.js'
import Save from 'lucide-react/dist/esm/icons/save.js'
import XCircle from 'lucide-react/dist/esm/icons/x-circle.js'
import Plus from 'lucide-react/dist/esm/icons/plus.js'
import Info from 'lucide-react/dist/esm/icons/info.js'
import UserCircle from 'lucide-react/dist/esm/icons/user-circle.js'
import LifeBuoy from 'lucide-react/dist/esm/icons/life-buoy.js'
import FileSpreadsheet from 'lucide-react/dist/esm/icons/file-spreadsheet.js'
import RefreshCw from 'lucide-react/dist/esm/icons/refresh-cw.js'

const defaultSize = 18
const defaultStroke = 1.8

const withDefaultProps = (props = {}) => ({ size: defaultSize, strokeWidth: defaultStroke, ...props })

export const DashboardIcon = (props) => <LayoutDashboard {...withDefaultProps(props)} />
export const InventoryIcon = (props) => <Boxes {...withDefaultProps(props)} />
export const PeopleIcon = (props) => <Users {...withDefaultProps(props)} />
export const MaterialIcon = (props) => <Shield {...withDefaultProps(props)} />
export const EntryIcon = (props) => <LogIn {...withDefaultProps(props)} />
export const ExitIcon = (props) => <LogOut {...withDefaultProps(props)} />
export const ChecklistIcon = (props) => <ClipboardList {...withDefaultProps(props)} />

export const MovementIcon = (props) => <ArrowDownUp {...withDefaultProps(props)} />
export const RevenueIcon = (props) => <CircleDollarSign {...withDefaultProps(props)} />
export const StockIcon = (props) => <ShoppingCart {...withDefaultProps(props)} />
export const AlertIcon = (props) => <AlertTriangle {...withDefaultProps(props)} />
export const NotificationIcon = (props) => <BellRing {...withDefaultProps(props)} />
export const TrendIcon = (props) => <TrendingUp {...withDefaultProps(props)} />
export const PieIcon = (props) => <PieChart {...withDefaultProps(props)} />
export const BarsIcon = (props) => <BarChart3 {...withDefaultProps(props)} />
export const ChevronIcon = (props) => <ChevronDown {...withDefaultProps(props)} />
export const SaveIcon = (props) => <Save {...withDefaultProps(props)} />
export const EditIcon = (props) => <PenSquare {...withDefaultProps(props)} />
export const HistoryIcon = (props) => <History {...withDefaultProps(props)} />
export const CancelIcon = (props) => <XCircle {...withDefaultProps(props)} />
export const ExpandIcon = (props) => <Maximize2 {...withDefaultProps(props)} />
export const AddIcon = (props) => <Plus {...withDefaultProps(props)} />
export const InfoIcon = (props) => <Info {...withDefaultProps(props)} />
export const PersonIcon = (props) => <UserCircle {...withDefaultProps(props)} />
export const HelpIcon = (props) => <LifeBuoy {...withDefaultProps(props)} />
export const SpreadsheetIcon = (props) => <FileSpreadsheet {...withDefaultProps(props)} />
export const RefreshIcon = (props) => <RefreshCw {...withDefaultProps(props)} />
