import {createFileRoute} from '@tanstack/react-router';
import {handleAiRecharge} from '../server/ai-recharge.mjs';
export const Route=createFileRoute('/api/payments/ai-recharge')({
 server:{handlers:{POST:({request})=>handleAiRecharge(request,{
  RAZORPAY_KEY_ID:process.env['RAZORPAY_KEY_ID'],
  RAZORPAY_KEY_SECRET:process.env['RAZORPAY_KEY_SECRET'],
  SIMS_RECHARGE_SHARED_SECRET:process.env['SIMS_RECHARGE_SHARED_SECRET'],
 })}},
});
