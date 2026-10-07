import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import Razorpay from 'razorpay';
import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';

const app=express(); app.use(cors({origin:process.env.CORS_ORIGIN||'*'})); app.use(express.json({limit:'2mb'}));
const port=Number(process.env.PORT||8080);
const supabase=createClient(process.env.SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
const razorpay=(process.env.RAZORPAY_KEY_ID&&process.env.RAZORPAY_KEY_SECRET)?new Razorpay({key_id:process.env.RAZORPAY_KEY_ID,key_secret:process.env.RAZORPAY_KEY_SECRET}):null;
const adminIds=new Set((process.env.ADMIN_USER_IDS||'').split(',').map(x=>x.trim()).filter(Boolean));

async function auth(req,res,next){try{const h=req.headers.authorization||''; if(!h.startsWith('Bearer ')) return res.status(401).json({error:'Login required'}); const token=h.slice(7); const {data,error}=await supabase.auth.getUser(token); if(error||!data.user) return res.status(401).json({error:'Invalid login'}); req.user=data.user; req.token=token; next();}catch(e){res.status(401).json({error:'Authentication failed'})}}
function adminOnly(req,res,next){if(!adminIds.has(req.user.id)) return res.status(403).json({error:'Admin access required'}); next()}
app.get('/health',(req,res)=>res.json({ok:true,service:'buy-anytime',time:new Date().toISOString()}));
app.get('/api/config',(req,res)=>res.json({razorpayKeyId:process.env.RAZORPAY_KEY_ID||''}));
app.get('/api/products',async(req,res)=>{const {data,error}=await supabase.from('products').select('*').eq('active',true).order('created_at',{ascending:false}); if(error)return res.status(500).json({error:error.message}); res.json({products:data||[]})});
app.get('/api/orders',auth,async(req,res)=>{const {data,error}=await supabase.from('orders').select('*,order_items(*)').eq('user_id',req.user.id).order('created_at',{ascending:false}); if(error)return res.status(500).json({error:error.message});res.json({orders:data||[]})});
app.post('/api/orders/create',auth,async(req,res)=>{
 try{
  const {items,address}=req.body; if(!Array.isArray(items)||!items.length) return res.status(400).json({error:'Cart is empty'});
  const ids=items.map(x=>x.productId); const {data:products,error}=await supabase.from('products').select('*').in('id',ids).eq('active',true); if(error)throw error;
  const map=new Map(products.map(p=>[p.id,p])); let subtotal=0; const normalized=[];
  for(const item of items){const p=map.get(item.productId); const q=Math.max(1,Math.floor(Number(item.quantity||1))); if(!p)throw new Error('Product unavailable'); if(q>p.stock)throw new Error(`Insufficient stock: ${p.name}`); subtotal+=Number(p.price)*q; normalized.push({p,q})}
  const shipping=subtotal>=499?0:49; const total=subtotal+shipping;
  const {data:order,error:oe}=await supabase.from('orders').insert({user_id:req.user.id,status:'Pending',payment_status:'Pending',subtotal,shipping,total,currency:'INR',shipping_address:address}).select().single(); if(oe)throw oe;
  const {error:ie}=await supabase.from('order_items').insert(normalized.map(({p,q})=>({order_id:order.id,product_id:p.id,name:p.name,price:p.price,quantity:q,image_url:p.image_url}))); if(ie)throw ie;
  if(!razorpay) return res.json({order,razorpayConfigured:false});
  const rp=await razorpay.orders.create({amount:Math.round(total*100),currency:'INR',receipt:order.id,notes:{buy_anytime_order_id:order.id,user_id:req.user.id}});
  await supabase.from('orders').update({razorpay_order_id:rp.id}).eq('id',order.id);
  res.json({order:{...order,razorpay_order_id:rp.id},razorpayConfigured:true,razorpayOrderId:rp.id,amount:rp.amount,currency:rp.currency});
 }catch(e){res.status(400).json({error:e.message||'Could not create order'})}
});
app.post('/api/payments/verify',auth,async(req,res)=>{try{const {orderId,razorpay_order_id,razorpay_payment_id,razorpay_signature}=req.body; const payload=`${razorpay_order_id}|${razorpay_payment_id}`; const expected=crypto.createHmac('sha256',process.env.RAZORPAY_KEY_SECRET).update(payload).digest('hex'); if(expected!==razorpay_signature)return res.status(400).json({error:'Invalid payment signature'}); const {data,error}=await supabase.from('orders').update({payment_status:'Paid',status:'Confirmed',payment_id:razorpay_payment_id}).eq('id',orderId).eq('user_id',req.user.id).select().single(); if(error)throw error; res.json({ok:true,order:data});}catch(e){res.status(400).json({error:e.message||'Payment verification failed'})}});
app.get('/api/admin/overview',auth,adminOnly,async(req,res)=>{const [{data:products},{data:orders}]=await Promise.all([supabase.from('products').select('*').order('created_at',{ascending:false}),supabase.from('orders').select('*').order('created_at',{ascending:false})]); const revenue=(orders||[]).filter(o=>o.payment_status==='Paid').reduce((s,o)=>s+Number(o.total),0); res.json({products:products||[],orders:orders||[],stats:{products:(products||[]).length,orders:(orders||[]).length,revenue,lowStock:(products||[]).filter(p=>p.stock<10).length}})});
app.post('/api/admin/products',auth,adminOnly,async(req,res)=>{const b=req.body; const {data,error}=await supabase.from('products').insert({name:b.name,category:b.category,price:Number(b.price),old_price:b.oldPrice?Number(b.oldPrice):null,rating:Number(b.rating||0),stock:Number(b.stock||0),badge:b.badge||'New',description:b.description||'',image_url:b.imageUrl||null,active:b.active!==false}).select().single(); if(error)return res.status(400).json({error:error.message});res.json({product:data})});
app.patch('/api/admin/products/:id',auth,adminOnly,async(req,res)=>{const b=req.body; const patch={}; for(const [a,k] of [['name','name'],['category','category'],['price','price'],['oldPrice','old_price'],['rating','rating'],['stock','stock'],['badge','badge'],['description','description'],['imageUrl','image_url'],['active','active']])if(b[a]!==undefined)patch[k]=['price','oldPrice','rating','stock'].includes(a)?Number(b[a]):b[a]; const {data,error}=await supabase.from('products').update(patch).eq('id',req.params.id).select().single();if(error)return res.status(400).json({error:error.message});res.json({product:data})});
app.delete('/api/admin/products/:id',auth,adminOnly,async(req,res)=>{const {error}=await supabase.from('products').update({active:false}).eq('id',req.params.id);if(error)return res.status(400).json({error:error.message});res.json({ok:true})});
app.patch('/api/admin/orders/:id',auth,adminOnly,async(req,res)=>{const allowed=['Pending','Confirmed','Packed','Shipped','Delivered','Cancelled','Payment Failed']; if(!allowed.includes(req.body.status))return res.status(400).json({error:'Invalid status'}); const {data,error}=await supabase.from('orders').update({status:req.body.status}).eq('id',req.params.id).select().single();if(error)return res.status(400).json({error:error.message});res.json({order:data})});
app.use(express.static(new URL('../admin',import.meta.url).pathname));
app.listen(port,()=>console.log(`Buy Anytime API listening on ${port}`));
