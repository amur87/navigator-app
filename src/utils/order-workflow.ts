export const KNOWN_ORDER_STATUSES = [
    'created',
    'pending',
    'preparing',
    'assigned',
    'dispatched',
    'driver_enroute',
    'enroute',
    'started',
    'pickup_ready',
    'in_progress',
    'requires_update',
    'completed',
    'order_completed',
    'canceled',
    'order_canceled',
    'failed',
    'incomplete',
    'unable',
] as const;

export type KnownOrderStatus = (typeof KNOWN_ORDER_STATUSES)[number];
export type CourierWorkflowStage =
    | 'incoming_offer'
    | 'accepted'
    | 'enroute'
    | 'active'
    | 'completed'
    | 'canceled'
    | 'unknown';

export const TERMINAL_ORDER_STATUSES = new Set(['completed', 'order_completed', 'canceled', 'order_canceled', 'failed', 'incomplete', 'unable']);
export const COMPLETED_ORDER_STATUSES = new Set(['completed', 'order_completed']);
export const CANCELED_ORDER_STATUSES = new Set(['canceled', 'order_canceled', 'failed', 'incomplete', 'unable']);
export const HISTORY_ORDER_STATUSES = new Set(['completed', 'order_completed', 'canceled', 'order_canceled']);
export const ACTIVE_COURIER_ORDER_STATUSES = new Set([
    'assigned',
    'dispatched',
    'driver_enroute',
    'enroute',
    'started',
    'pickup_ready',
    'in_progress',
    'requires_update',
    'pending',
    'preparing',
]);

const STATUS_LABELS: Record<string, string> = {
    created: '\u041d\u043e\u0432\u044b\u0439',
    pending: '\u041e\u0436\u0438\u0434\u0430\u0435\u0442',
    preparing: '\u0413\u043e\u0442\u043e\u0432\u0438\u0442\u0441\u044f',
    assigned: '\u041d\u0430\u0437\u043d\u0430\u0447\u0435\u043d',
    dispatched: '\u041e\u0442\u043f\u0440\u0430\u0432\u043b\u0435\u043d',
    driver_enroute: '\u041a\u0443\u0440\u044c\u0435\u0440 \u0435\u0434\u0435\u0442',
    enroute: '\u0412 \u043f\u0443\u0442\u0438',
    started: '\u041d\u0430\u0447\u0430\u0442',
    pickup_ready: '\u0413\u043e\u0442\u043e\u0432 \u043a \u0432\u044b\u0434\u0430\u0447\u0435',
    in_progress: '\u0412 \u043f\u0440\u043e\u0446\u0435\u0441\u0441\u0435',
    requires_update: '\u0422\u0440\u0435\u0431\u0443\u0435\u0442 \u043e\u0431\u043d\u043e\u0432\u043b\u0435\u043d\u0438\u044f',
    completed: '\u0412\u044b\u043f\u043e\u043b\u043d\u0435\u043d',
    order_completed: '\u0412\u044b\u043f\u043e\u043b\u043d\u0435\u043d',
    canceled: '\u041e\u0442\u043c\u0435\u043d\u0435\u043d',
    order_canceled: '\u041e\u0442\u043c\u0435\u043d\u0435\u043d',
    failed: '\u041d\u0435 \u0432\u044b\u043f\u043e\u043b\u043d\u0435\u043d',
    incomplete: '\u041d\u0435 \u0437\u0430\u0432\u0435\u0440\u0448\u0435\u043d',
    unable: '\u041d\u0435\u0432\u043e\u0437\u043c\u043e\u0436\u043d\u043e \u0432\u044b\u043f\u043e\u043b\u043d\u0438\u0442\u044c',
};

export function normalizeOrderStatus(status?: string | null): string {
    return String(status ?? '').trim().toLowerCase();
}

export function getOrderStatusLabel(status?: string | null): string {
    const normalized = normalizeOrderStatus(status);
    return STATUS_LABELS[normalized] ?? (normalized ? normalized.replaceAll('_', ' ') : '\u041d\u0435\u0438\u0437\u0432\u0435\u0441\u0442\u043d\u043e');
}

export function getCourierWorkflowStage(params: { status?: string | null; isAdhoc?: boolean; isAssigned?: boolean }): CourierWorkflowStage {
    const status = normalizeOrderStatus(params.status);

    if (COMPLETED_ORDER_STATUSES.has(status)) {
        return 'completed';
    }

    if (CANCELED_ORDER_STATUSES.has(status)) {
        return 'canceled';
    }

    if (params.isAdhoc && params.isAssigned === false && !TERMINAL_ORDER_STATUSES.has(status)) {
        return 'incoming_offer';
    }

    if (status === 'assigned' || status === 'dispatched' || status === 'created' || status === 'pending' || status === 'preparing') {
        return 'accepted';
    }

    if (status === 'driver_enroute' || status === 'enroute' || status === 'started') {
        return 'enroute';
    }

    if (status === 'pickup_ready' || status === 'in_progress' || status === 'requires_update') {
        return 'active';
    }

    return 'unknown';
}

export function getCourierPrimaryAction(params: { stage: CourierWorkflowStage }) {
    switch (params.stage) {
        case 'incoming_offer':
            return { key: 'accept', label: '\u041f\u0440\u0438\u043d\u044f\u0442\u044c \u0437\u0430\u043a\u0430\u0437' };
        case 'accepted':
            return { key: 'start', label: '\u041d\u0430\u0447\u0430\u0442\u044c \u0437\u0430\u043a\u0430\u0437' };
        case 'enroute':
        case 'active':
            return { key: 'update', label: '\u041e\u0431\u043d\u043e\u0432\u0438\u0442\u044c \u0441\u0442\u0430\u0442\u0443\u0441' };
        default:
            return null;
    }
}
