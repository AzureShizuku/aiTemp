(function(root){
 'use strict';
 const uid=()=>globalThis.crypto?.randomUUID?.()||Date.now().toString(36)+Math.random().toString(36).slice(2);
 const task=()=>({id:uid(),title:'',quantity:'1000',currency:'CNY',deadline:'',rates:{CNY:'1',USD:'',EUR:''},quotes:[],example:false,updatedAt:''});
 const quote=()=>({id:uid(),name:'',price:'',currency:'',unit:'',pack:'',moq:'',days:'',freight:'',extra:'',terms:'',spec:'',specConfirmed:false,original:'',files:[]});
 function validateQuote(q){
  if(!q.name.trim())return '请填写供应商名称';
  if(!/^\d+(\.\d{1,4})?$/.test(q.price)||Number(q.price)<=0||Number(q.price)>1e9)return '请确认单价，最多支持 4 位小数';
  if(!['CNY','USD','EUR'].includes(q.currency))return '请选择报价币种';
  if(!['个','箱'].includes(q.unit))return '请选择计价单位';
  for(const k of ['freight','extra'])if(q[k]!==''&&(!/^\d+(\.\d{1,4})?$/.test(q[k])||Number(q[k])>1e9))return '费用需为非负数字，最多 4 位小数';
  for(const k of ['pack','moq','days'])if(q[k]!==''&&(!/^\d+$/.test(q[k])||Number(q[k])<1||Number(q[k])>1e8))return '每箱数量、起订量及交期需为正整数';
  if(q.unit==='箱'&&!q.pack)return '请填写每箱数量';
  return '';
 }
 function validateTask(t){
  if(!t.title.trim())return '请填写商品名称';
  if(!/^\d+$/.test(t.quantity)||Number(t.quantity)<1||Number(t.quantity)>1e8)return '请填写有效的采购数量';
  if(t.deadline!==''&&(!/^\d+$/.test(t.deadline)||Number(t.deadline)<1))return '请填写有效的期望交期';
  if(t.quotes.length<2)return '至少添加两家供应商报价';
  return '';
 }
 function example(){const t={...task(),title:'500ml 双层保温杯',deadline:'20',rates:{CNY:'1',USD:'7.2',EUR:'7.9'},example:true};t.quotes=[
  {...quote(),name:'佳禾日用品',price:'12',currency:'CNY',unit:'个',moq:'500',days:'15',extra:'0',terms:'含税国内交付',spec:'304 不锈钢 · 500ml · 彩盒',specConfirmed:true,original:'供应商：佳禾日用品\n单价：¥12/个\nMOQ：500\n交期：15天\n运费待确认\n其他费用：0\n报价条件：含税国内交付'},
  {...quote(),name:'海辰商贸',price:'1.75',currency:'USD',unit:'个',moq:'1000',days:'12',freight:'0',extra:'0',terms:'含税国内交付',spec:'304 不锈钢 · 500ml · 彩盒',specConfirmed:true,original:'供应商：海辰商贸\n单价：USD 1.75/个\nMOQ：1000\n交期：12天\n运费已含\n其他费用：0\n报价条件：含税国内交付'},
  {...quote(),name:'瑞丰家居',price:'292.8',currency:'CNY',unit:'箱',pack:'24',moq:'1200',days:'7',freight:'180',extra:'0',terms:'含税国内交付',spec:'304 不锈钢 · 500ml · 彩盒',specConfirmed:true,original:'供应商：瑞丰家居\n单价：¥292.80/箱\n每箱：24个\nMOQ：1200\n交期：7天\n运费：180\n其他费用：0\n报价条件：含税国内交付'}];return t;}
 const symbol=c=>({CNY:'¥',USD:'$',EUR:'€'}[c]||'');
 const unitPrice=n=>Number(n).toLocaleString('zh-CN',{minimumFractionDigits:2,maximumFractionDigits:4});
 function questions(t,q,lang='zh'){
  const x=root.CompareCore.calculate(t,q),en=lang==='en',items=[];
  if(x.freight==null)items.push(en?'Please confirm the freight cost and delivery destination.':'请确认本次数量的运费及交付目的地。');
  if(x.extra==null)items.push(en?'Please confirm taxes and all other fees, and specify what is included.':'请确认税费及其他费用，以及报价包含的费用范围。');
  if(!q.moq)items.push(en?'Please confirm the minimum order quantity.':'请确认最小起订量。');
  else if(Number(q.moq)>Number(t.quantity))items.push(en?`Can you accept ${t.quantity} pieces, below the current MOQ?`:`能否接受 ${t.quantity} 个的数量，降低当前起订量？`);
  if(!q.days)items.push(en?'Please confirm the lead time.':'请确认本次订单的交期。');
  else if(t.deadline&&Number(q.days)>Number(t.deadline))items.push(en?`Can you deliver within ${t.deadline} days?`:`能否将交期缩短至 ${t.deadline} 天以内？`);
  if(!q.terms)items.push(en?'Please confirm delivery terms, named location and cost coverage.':'请确认报价条件、指定地点及费用覆盖范围。');
  if(!q.specConfirmed)items.push(en?`Please confirm the specification: ${q.spec||t.title}.`:`请确认商品规格：${q.spec||t.title}。`);
  if(x.wholeBox)items.push(en?`Can you supply exactly ${t.quantity} pieces instead of full cartons?`:`能否按 ${t.quantity} 个供货，而非必须整箱采购？`);
  items.push(en?'Please confirm quotation validity and available stock.':'请确认报价有效期和当前可供库存。');
  return (en?`Hello ${q.name},\nRegarding ${t.quantity} pieces of ${t.title}, please confirm:\n\n`:`${q.name}，您好！\n关于本次 ${t.quantity} 个「${t.title}」的采购，请确认：\n\n`)+items.map((s,i)=>`${i+1}. ${s}`).join('\n')+(en?'\n\nThank you.':'\n\n谢谢！');
 }
 function csv(t){const C=root.CompareCore,a=C.analyze(t);const encode=c=>{let s=String(c??'');if(/^[=+\-@\t\r]/.test(s))s="'"+s;return '"'+s.replace(/"/g,'""')+'"';};const rows=[['采购比价报告',t.example?'示例报价':''],['商品',t.title],['采购数量',t.quantity],['比较币种',t.currency],['汇率（用户输入）',...Object.entries(t.rates).filter(([,v])=>v).map(([k,v])=>`1 ${k} = ${v} ${t.currency}`)],[],['供应商','规格','原始单价','币种','计价单位','每箱数量','换算单价/个','商品金额','运费','其他费用','已知费用合计','MOQ','交期/天','报价条件','规格已确认','待关注']];for(const x of a.items){const q=x.quote;rows.push([q.name,q.spec,q.price,q.currency,q.unit,q.pack,x.invalid?'':unitPrice(x.unit),x.invalid?'':C.money(x.goods),x.freight==null?'未提供':C.money(x.freight),x.extra==null?'未确认':C.money(x.extra),x.invalid?'':C.money(x.total),q.moq||'未提供',q.days||'未提供',q.terms,q.specConfirmed?'是':'否',x.issues.join('；')]);}rows.push([],['口径说明','未知费用不按零计算。同条件合计排名要求规格、费用、数量和报价条件可比。']);return '\uFEFF'+rows.map(r=>r.map(encode).join(',')).join('\r\n');}
 const api={uid,task,quote,validateQuote,validateTask,example,symbol,unitPrice,questions,csv};
 if(typeof module!=='undefined')module.exports=api;else root.QuoteFlow=api;
})(typeof globalThis!=='undefined'?globalThis:this);
