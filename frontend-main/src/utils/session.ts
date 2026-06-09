

const SESSION_ID_KEY = 'browser_session_id';

function generateUUID(): string {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        return crypto.randomUUID();
    }

    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

export function getBrowserSessionId(): string {
    if (typeof window === 'undefined') {
        return '';
    }

    let sessionId = localStorage.getItem(SESSION_ID_KEY);

    if (!sessionId) {
        sessionId = generateUUID();
        localStorage.setItem(SESSION_ID_KEY, sessionId);
    }

    return sessionId;
}

export function clearBrowserSessionId(): void {
    if (typeof window === 'undefined') return;
    localStorage.removeItem(SESSION_ID_KEY);
}

export function hasBrowserSessionId(): boolean {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem(SESSION_ID_KEY) !== null;
}
