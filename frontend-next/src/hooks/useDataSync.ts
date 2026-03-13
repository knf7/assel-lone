import { useEffect, useRef } from 'react';
import { DataSyncEvent, subscribeDataSync } from '@/lib/api';

type Options = {
    scopes?: string[];
    debounceMs?: number;
};

const matchesScope = (event: DataSyncEvent | undefined, scopes?: string[]) => {
    if (!event || !scopes || scopes.length === 0) return true;
    return event.scopes?.some((scope) => scopes.includes(scope));
};

export const useDataSync = (handler: (event: DataSyncEvent) => void, options: Options = {}) => {
    const handlerRef = useRef(handler);
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        handlerRef.current = handler;
    }, [handler]);

    useEffect(() => {
        const debounceMs = options.debounceMs ?? 200;
        const unsubscribe = subscribeDataSync((event) => {
            if (!matchesScope(event, options.scopes)) return;
            if (debounceMs <= 0) {
                handlerRef.current(event);
                return;
            }
            if (timerRef.current) {
                clearTimeout(timerRef.current);
            }
            timerRef.current = setTimeout(() => {
                handlerRef.current(event);
            }, debounceMs);
        });
        return () => {
            if (timerRef.current) {
                clearTimeout(timerRef.current);
                timerRef.current = null;
            }
            unsubscribe();
        };
    }, [options.debounceMs, (options.scopes || []).join('|')]);
};
