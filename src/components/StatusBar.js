import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
const STATUS_LABELS = {
    connected: 'Connected',
    connecting: 'Connecting…',
    reconnecting: 'Reconnecting…',
    failed: 'Connection failed',
    disconnected: 'Disconnected'
};
function StatusIcon({ status }) {
    switch (status) {
        case 'connected':
            return _jsx("span", { className: "status-icon status-connected", "aria-hidden": "true" });
        case 'reconnecting':
        case 'connecting':
            return _jsx("span", { className: "status-icon status-reconnecting", "aria-hidden": "true" });
        case 'failed':
            return _jsx("span", { className: "status-icon status-failed", "aria-hidden": "true" });
        default:
            return _jsx("span", { className: "status-icon status-disconnected", "aria-hidden": "true" });
    }
}
export function StatusBar({ status, timestamp }) {
    return (_jsxs("footer", { className: "status-bar", "aria-live": "polite", children: [_jsxs("div", { className: "status-group", children: [_jsx(StatusIcon, { status: status }), _jsx("span", { children: STATUS_LABELS[status] })] }), _jsxs("div", { className: "status-group", children: [_jsx("span", { className: "status-label", children: "Last update" }), _jsx("time", { dateTime: timestamp ?? undefined, children: timestamp ? new Date(timestamp).toLocaleTimeString() : '—' })] })] }));
}
