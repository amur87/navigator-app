export type DriverStatus = 'pending' | 'active' | 'inactive' | 'blocked';

export const DRIVER_STATUSES: DriverStatus[] = ['pending', 'active', 'inactive', 'blocked'];

export function canDriverWork(status: DriverStatus | string | undefined): boolean {
    return status === 'active';
}

export function canDriverGoOnline(status: DriverStatus | string | undefined): boolean {
    return status === 'active';
}

type StatusMeta = {
    label: Record<string, string>;
    description: Record<string, string>;
    color: string;
    bgColor: string;
    icon: 'clock' | 'check' | 'pause' | 'ban';
    actions: Array<'refresh' | 'support' | 'logout'>;
};

const STATUS_META: Record<DriverStatus, StatusMeta> = {
    pending: {
        label: {
            ru: 'На проверке',
            en: 'Pending Review',
            ky: 'Текшерүүдө',
        },
        description: {
            ru: 'Ваш аккаунт курьера зарегистрирован и ожидает проверки. После одобрения вы сможете выйти на линию и принимать заказы.',
            en: 'Your courier account is registered and awaiting review. Once approved, you will be able to go online and accept orders.',
            ky: 'Сиздин курьер аккаунтуңуз катталган жана текшерүүнү күтүүдө. Бекитилгенден кийин линияга чыгып, заказдарды кабыл алсаңыз болот.',
        },
        color: '#FF9500',
        bgColor: 'rgba(255,149,0,0.12)',
        icon: 'clock',
        actions: ['refresh', 'support'],
    },
    active: {
        label: {
            ru: 'Активен',
            en: 'Active',
            ky: 'Активдүү',
        },
        description: {
            ru: 'Ваш аккаунт активен. Вы можете выходить на линию и принимать заказы.',
            en: 'Your account is active. You can go online and accept orders.',
            ky: 'Аккаунтуңуз активдүү. Линияга чыгып, заказдарды кабыл алсаңыз болот.',
        },
        color: '#34C759',
        bgColor: 'rgba(52,199,89,0.15)',
        icon: 'check',
        actions: [],
    },
    inactive: {
        label: {
            ru: 'Неактивен',
            en: 'Inactive',
            ky: 'Активдүү эмес',
        },
        description: {
            ru: 'Ваш аккаунт временно не может использоваться для работы. Обратитесь в поддержку или дождитесь активации.',
            en: 'Your account is temporarily unavailable for work. Contact support or wait for activation.',
            ky: 'Аккаунтуңуз убактылуу иштей албайт. Колдоо кызматына кайрылыңыз же активдештирүүнү күтүңүз.',
        },
        color: '#FF9500',
        bgColor: 'rgba(255,149,0,0.15)',
        icon: 'pause',
        actions: ['refresh', 'support'],
    },
    blocked: {
        label: {
            ru: 'Заблокирован',
            en: 'Blocked',
            ky: 'Бөгөттөлгөн',
        },
        description: {
            ru: 'Доступ к работе ограничен. Для уточнения причины обратитесь в поддержку.',
            en: 'Access to work is restricted. Contact support to clarify the reason.',
            ky: 'Иштөөгө кирүү чектелген. Себебин билүү үчүн колдоо кызматына кайрылыңыз.',
        },
        color: '#FF3B30',
        bgColor: 'rgba(255,59,48,0.12)',
        icon: 'ban',
        actions: ['support', 'logout'],
    },
};

export function getDriverStatusMeta(status: DriverStatus | string | undefined): StatusMeta {
    return STATUS_META[(status as DriverStatus)] ?? STATUS_META.inactive;
}

export function getOnlineBlockMessage(status: DriverStatus | string | undefined, locale: string = 'ru'): { title: string; message: string } {
    const messages: Record<string, Record<string, { title: string; message: string }>> = {
        pending: {
            ru: { title: 'Аккаунт на проверке', message: 'Ваш аккаунт ещё не одобрен. Дождитесь проверки.' },
            en: { title: 'Account Pending', message: 'Your account has not been approved yet. Please wait for review.' },
            ky: { title: 'Аккаунт текшерүүдө', message: 'Аккаунтуңуз али бекитиле элек. Текшерүүнү күтүңүз.' },
        },
        inactive: {
            ru: { title: 'Аккаунт неактивен', message: 'Ваш аккаунт неактивен. Выход на линию недоступен.' },
            en: { title: 'Account Inactive', message: 'Your account is inactive. Going online is unavailable.' },
            ky: { title: 'Аккаунт активдүү эмес', message: 'Аккаунтуңуз активдүү эмес. Линияга чыгуу мүмкүн эмес.' },
        },
        blocked: {
            ru: { title: 'Аккаунт заблокирован', message: 'Ваш аккаунт заблокирован. Обратитесь в поддержку.' },
            en: { title: 'Account Blocked', message: 'Your account is blocked. Please contact support.' },
            ky: { title: 'Аккаунт бөгөттөлгөн', message: 'Аккаунтуңуз бөгөттөлгөн. Колдоо кызматына кайрылыңыз.' },
        },
    };

    const key = status && status !== 'active' ? status : 'inactive';
    const localeMessages = messages[key] ?? messages.inactive;
    return localeMessages[locale] ?? localeMessages.ru;
}

export function normalizeDriverStatus(status: string | undefined | null): DriverStatus {
    if (!status) return 'active';
    const s = status.toLowerCase().trim();
    if (DRIVER_STATUSES.includes(s as DriverStatus)) return s as DriverStatus;
    return 'active';
}
