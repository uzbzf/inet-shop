'use client';

import React, { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import confetti from 'canvas-confetti';
import { CheckCircle2, XCircle, CreditCard, ArrowRight, X } from 'lucide-react';

function StripePaymentStatusContent() {
  const searchParams = useSearchParams();
  const stripeStatus = searchParams.get('stripe');
  const orderNumber = searchParams.get('orderNumber');
  const sessionId = searchParams.get('session_id');
  const orderId = searchParams.get('orderId');

  const [isOpen, setIsOpen] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [verificationDone, setVerificationDone] = useState(false);

  useEffect(() => {
    if (stripeStatus === 'success') {
      setIsOpen(true);
      confetti({
        particleCount: 150,
        spread: 80,
        origin: { y: 0.6 },
      });

      if (sessionId) {
        setIsVerifying(true);
        fetch(`/api/stripe/verify-session?sessionId=${sessionId}&orderId=${orderId || ''}`)
          .then((res) => res.json())
          .then(() => setVerificationDone(true))
          .catch(() => {})
          .finally(() => setIsVerifying(false));
      }
    } else if (stripeStatus === 'cancel') {
      setIsOpen(true);
    }
  }, [stripeStatus, sessionId, orderId]);

  if (!isOpen || !stripeStatus) return null;

  const handleClose = () => {
    setIsOpen(false);
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      url.searchParams.delete('stripe');
      url.searchParams.delete('orderId');
      url.searchParams.delete('orderNumber');
      url.searchParams.delete('session_id');
      window.history.replaceState({}, '', url.pathname);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl relative text-center space-y-5 animate-in zoom-in-95 duration-200">
        <button
          onClick={handleClose}
          className="absolute top-4 right-4 p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition"
        >
          <X className="w-5 h-5" />
        </button>

        {stripeStatus === 'success' ? (
          <>
            <div className="w-16 h-16 rounded-full bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-9 h-9" />
            </div>

            <div className="space-y-1.5">
              <span className="text-[11px] font-bold tracking-wider uppercase text-emerald-500">
                Оплата подтверждена
              </span>
              <h3 className="text-2xl font-black text-slate-900 dark:text-white">
                Заказ успешно оплачен!
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Платеж через Stripe (Visa / Mastercard) успешно авторизован.
              </p>
            </div>

            {orderNumber && (
              <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-xs font-mono">
                <span className="text-slate-400 block text-[10px] uppercase">Номер вашего заказа</span>
                <span className="text-base font-bold text-cyan-600 dark:text-cyan-400">{orderNumber}</span>
              </div>
            )}

            <div className="p-3 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-left text-xs text-slate-700 dark:text-slate-300 flex items-start gap-2.5">
              <CreditCard className="w-4 h-4 text-cyan-500 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold text-slate-900 dark:text-white block">Чек отправлен:</span>
                <span>Фискальный чек и состав заказа переданы в учетную систему магазина и отправлены в Telegram.</span>
              </div>
            </div>

            <button
              onClick={handleClose}
              className="w-full py-3.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-cyan-500/25 transition active:scale-95"
            >
              <span>Продолжить покупки</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </>
        ) : (
          <>
            <div className="w-16 h-16 rounded-full bg-amber-500/10 text-amber-500 border border-amber-500/20 flex items-center justify-center mx-auto">
              <XCircle className="w-9 h-9" />
            </div>

            <div className="space-y-1.5">
              <span className="text-[11px] font-bold tracking-wider uppercase text-amber-500">
                Оплата отменена
              </span>
              <h3 className="text-2xl font-black text-slate-900 dark:text-white">
                Платеж не завершен
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Сессия оплаты Stripe была прервана. Ваши товары сохранены в корзине.
              </p>
            </div>

            <button
              onClick={handleClose}
              className="w-full py-3.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white dark:bg-white dark:text-slate-950 font-bold text-sm transition"
            >
              Вернуться в корзину
            </button>
          </>
        )}
      </div>
    </div>
  );
}

export function StripePaymentStatusModal() {
  return (
    <Suspense fallback={null}>
      <StripePaymentStatusContent />
    </Suspense>
  );
}
