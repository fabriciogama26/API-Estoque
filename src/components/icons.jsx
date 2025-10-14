import {
  AlertTriangle,
  ArrowDownUp,
  BarChart3,
  ChevronDown,
  Boxes,
  CircleDollarSign,
  ClipboardList,
  LayoutDashboard,
  LogIn,
  LogOut,
  PieChart,
  Shield,
  ShoppingCart,
  TrendingUp,
  Users,
  Save,
} from 'lucide-react'

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
export const TrendIcon = (props) => <TrendingUp {...withDefaultProps(props)} />
export const PieIcon = (props) => <PieChart {...withDefaultProps(props)} />
export const BarsIcon = (props) => <BarChart3 {...withDefaultProps(props)} />
export const ChevronIcon = (props) => <ChevronDown {...withDefaultProps(props)} />
export const SaveIcon = (props) => <Save {...withDefaultProps(props)} />
