(function(root) {
  'use strict';
  const fixed=(value,digits)=>{
    if(!/^\d+(?:\.\d+)?$/.test(String(value))) throw new Error('请输入有效的非负数字');
    const [whole,decimal='']=String(value).split('.');
    if(decimal.length>digits) throw new Error(`最多支持 ${digits} 位小数`);
    return BigInt(whole)*10n**BigInt(digits)+BigInt(decimal.padEnd(digits,'0')||'0');
  };
  const rounded=(n,d)=>(n+d/2n)/d;
  const amount=(price,quantity,pack,rate)=>Number(rounded(fixed(price,4)*BigInt(quantity)*fixed(rate,6),BigInt(pack)*100000000n));
  const money=(cents)=>Number(cents/100).toLocaleString('zh-CN',{minimumFractionDigits:2,maximumFractionDigits:2});
  function calculate(task,quote) {
    const rate=quote.currency===task.currency?'1':task.rates[quote.currency];
    if(!rate || Number(rate)<=0) return {quote,invalid:'请补充有效的汇率',issues:['缺少汇率']};
    const pack=quote.unit==='箱'?Number(quote.pack):1;
    if(!Number.isInteger(pack)||pack<1) return {quote,invalid:'请确认每箱数量',issues:['缺少每箱数量']};
    if(!Number.isFinite(Number(quote.price))||Number(quote.price)<=0) return {quote,invalid:'请填写有效单价',issues:['缺少有效单价']};
    const qty=Number(task.quantity);
    if(!Number.isInteger(qty)||qty<1) return {quote,invalid:'请填写有效采购数量',issues:['采购数量无效']};
    const goods=amount(quote.price,qty,pack,rate);
    const freight=quote.freight===''||quote.freight==null?null:amount(quote.freight,1,1,rate);
    const extra=quote.extra===''||quote.extra==null?null:amount(quote.extra,1,1,rate);
    const total=goods+(freight??0)+(extra??0);
    if(!Number.isSafeInteger(goods)||!Number.isSafeInteger(total))return {quote,invalid:'金额超出精确计算范围，请降低数量或金额',issues:['金额超出计算范围']};
    const missing=[];
    if(freight===null)missing.push('运费未提供');
    if(extra===null)missing.push('其他费用未确认');
    if(!quote.moq)missing.push('起订量未提供');
    if(!quote.days)missing.push('交期未提供');
    if(!quote.terms)missing.push('报价条件未提供');
    if(!quote.specConfirmed)missing.push('规格待核对');
    const moqOk=!!quote.moq&&Number(quote.moq)<=qty;
    const wholeBox=quote.unit==='箱'&&qty%pack!==0;
    const issues=[...missing];
    if(quote.moq&&!moqOk)issues.push('起订量超过需求');
    if(wholeBox)issues.push('采购数量不满整箱，需确认拆箱');
    if(task.deadline&&quote.days&&Number(quote.days)>Number(task.deadline))issues.push('交期超过要求');
    const comparable=freight!==null&&extra!==null&&moqOk&&quote.specConfirmed&&!wholeBox&&!!quote.terms;
    const actualQty=Math.ceil(Math.max(qty,Number(quote.moq)||qty)/pack)*pack;
    const actualGoods=amount(quote.price,actualQty,pack,rate);
    if(!Number.isSafeInteger(actualGoods))return {quote,invalid:'整箱或起订量金额超出精确计算范围',issues:['金额超出计算范围']};
    return {quote,rate,pack,goods,freight,extra,total,unit:Number(quote.price)*Number(rate)/pack,missing,issues,moqOk,wholeBox,comparable,actualQty,actualGoods};
  }
  function analyze(task){
    const items=task.quotes.map(q=>calculate(task,q));
    const valid=items.filter(x=>!x.invalid);
    const pricePool=valid.filter(x=>x.quote.specConfirmed);
    const cheapest=pricePool.length?pricePool.reduce((a,b)=>a.unit<=b.unit?a:b):null;
    const complete=valid.filter(x=>x.comparable);
    const groups=new Map();
    for(const x of complete){const k=x.quote.terms.trim().toUpperCase();if(!groups.has(k))groups.set(k,[]);groups.get(k).push(x);}
    const comparableGroups=[...groups.values()].filter(g=>g.length>=2);
    const lowest=comparableGroups.length===1?comparableGroups[0].reduce((a,b)=>a.total<=b.total?a:b):null;
    const fastPool=valid.filter(x=>Number(x.quote.days)>0&&x.moqOk&&x.quote.specConfirmed&&!x.wholeBox);
    const fastest=fastPool.length?fastPool.reduce((a,b)=>Number(a.quote.days)<=Number(b.quote.days)?a:b):null;
    const differences=valid.filter(x=>x.quote.terms).map(x=>x.quote.terms.trim().toUpperCase());
    return {items,cheapest,lowest,fastest,issueCount:items.reduce((n,x)=>n+x.issues.length,0),termsDiffer:new Set(differences).size>1};
  }
  function parseText(text){
    const take=(r)=>text.match(r)?.[1]?.replace(/,/g,'')??'';
    const p={};
    p.price=take(/(?:单价|价格|unit\s*price|price)\s*[:：]?\s*(?:人民币|RMB|CNY|USD|EUR|[¥￥$€])?\s*(\d[\d,]*(?:\.\d+)?)/i)||take(/[¥￥$€]\s*(\d[\d,]*(?:\.\d+)?)/);
    if(/USD|美元|\$/i.test(text))p.currency='USD';else if(/EUR|欧元|€/i.test(text))p.currency='EUR';else if(/CNY|RMB|人民币|[¥￥]/i.test(text))p.currency='CNY';
    if(/(?:\/|每|per\s*)(?:箱|carton|ctn|box)/i.test(text))p.unit='箱';
    p.pack=take(/(?:每箱|装箱数量|pack(?:ing)?)\s*[:：]?\s*(\d[\d,]*)/i)||take(/(\d[\d,]*)\s*(?:个|pcs|pieces)\s*(?:\/|per)\s*(?:箱|carton|ctn)/i);
    p.moq=take(/(?:MOQ|起订量|最小起订量)\s*[:：]?\s*(\d[\d,]*)/i);
    p.days=take(/(?:交期|交货期|lead\s*time|delivery)\s*[:：]?\s*(\d+)/i);
    p.freight=take(/(?:运费|shipping|freight)\s*[:：]?\s*(?:RMB|CNY|USD|EUR|[¥￥$€])?\s*(\d[\d,]*(?:\.\d+)?)/i);
    if(/(?:包邮|运费已含|含运费|shipping included|free shipping)/i.test(text))p.freight='0';
    p.extra=take(/(?:其他费用|other\s*fees|extra)\s*[:：]?\s*(?:RMB|CNY|USD|EUR|[¥￥$€])?\s*(\d[\d,]*(?:\.\d+)?)/i);
    p.terms=take(/(?:报价条件|贸易术语|terms)\s*[:：]\s*([^\n;；]+)/i)||take(/\b(EXW|FOB|CIF|DDP|DAP|FCA)\b/i);
    p.spec=take(/(?:规格|specification|spec)\s*[:：]\s*([^\n;；]+)/i);
    p.name=take(/(?:供应商|supplier)\s*[:：]\s*([^\n;；]+)/i);
    return Object.fromEntries(Object.entries(p).filter(([,v])=>v!==''));
  }
  const api={fixed,amount,money,calculate,analyze,parseText};
  if(typeof module!=='undefined')module.exports=api;else root.CompareCore=api;
})(typeof globalThis!=='undefined'?globalThis:this);
