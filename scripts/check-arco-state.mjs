import vm from 'node:vm';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const base=new URL('../web/',import.meta.url).pathname;
let mounted,tree,hookIndex=0,hookSlots=[],effectSlots=[],pendingEffects=[];
const node=(type,props,...children)=>({type,props:{...(props||{}),children:children.length===0?props?.children:children.length===1?children[0]:children}});
const R={createElement:node,Fragment:Symbol('Fragment'),Component:class{constructor(props){this.props=props;}},useState(init){const i=hookIndex++;if(!(i in hookSlots))hookSlots[i]=typeof init==='function'?init():init;return[hookSlots[i],value=>{hookSlots[i]=typeof value==='function'?value(hookSlots[i]):value;}];},useRef(value){const i=hookIndex++;if(!(i in hookSlots))hookSlots[i]={current:value};return hookSlots[i];},useEffect(fn,deps){const i=hookIndex++,old=effectSlots[i];if(!old||deps.some((x,j)=>x!==old.deps[j])){effectSlots[i]={deps};pendingEffects.push(fn);}}};
const A={};for(const name of ['ContextProvider','NavBar','Cell','Input','Textarea','Button','ActionSheet','Picker','Switch','TabBar','Popup','Uploader']){A[name]=Object.assign(()=>null,{arcoName:name});}A.Cell.Group=Object.assign(()=>null,{arcoName:'Cell.Group'});
const notices=[];A.Toast={info:s=>notices.push(s),error:s=>notices.push(s)};
let confirmation=null;A.Dialog={confirm:options=>{confirmation=options;return {close(){}};}};
const storage=new Map();const fileInput={setAttribute(){},removeAttribute(){},click(){},value:''};
function resolve(n){if(n==null||typeof n==='string'||typeof n==='number')return n;if(Array.isArray(n))return n.map(resolve);if(typeof n.type==='function'&&!n.type.arcoName){if(n.type.prototype?.render)return resolve(new n.type(n.props).render());return resolve(n.type(n.props));}const p={...n.props};for(const [k,v]of Object.entries(p)){if(k==='children'||v?.type)p[k]=resolve(v);}if(p.ref)p.ref.current={querySelector:()=>fileInput};return{...n,props:p};}
function refresh(){hookIndex=0;pendingEffects=[];tree=resolve(mounted);for(const effect of pendingEffects)effect();return tree;}
const window={React:R,Arco:A,ReactDOM:{createRoot:()=>({render:n=>{mounted=n;refresh();}}),flushSync:fn=>{fn();refresh();}},scrollTo(){},history:{length:1},dispatchEvent(){return true;},print(){}};
const context=vm.createContext({window,document:{getElementById:()=>({}),documentElement:{style:{}}},console,localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)},setTimeout:()=>1,clearTimeout(){},crypto:{randomUUID:()=>Math.random().toString(36).slice(2)},URL,Blob,File,FormData,Response,Request,AbortController,DOMException,CustomEvent:class{},navigator:{clipboard:{writeText:async()=>{}}},location:{href:'https://arco.test/'},fetch:async()=>new Response(JSON.stringify({configured:false,provider:'qwen',pdfMode:'render'})),globalThis:null});
context.globalThis=context;
for(const filename of ['core.js','quote-flow.js']){vm.runInContext(readFileSync(base+filename,'utf8'),context,{filename});}
window.CompareCore=context.CompareCore;window.QuoteFlow=context.QuoteFlow;
vm.runInContext(readFileSync(base+'arco-app.js','utf8'),context,{filename:'arco-app.js'});
function walk(n,out=[]){if(n==null)return out;if(Array.isArray(n)){n.forEach(x=>walk(x,out));return out;}if(typeof n==='object'){out.push(n);for(const v of Object.values(n.props||{}))if(v?.type||Array.isArray(v))walk(v,out);}return out;}
function arcos(name){return walk(tree).filter(n=>n.type?.arcoName===name);}
function byLabel(label){return arcos('Cell').find(n=>n.props.label===label);}
function input(label){return arcos('Input').find(n=>n.props.nativeProps?.['aria-label']===label);}
function texts(n){if(n==null)return '';if(Array.isArray(n))return n.map(texts).join('');if(typeof n!=='object')return String(n);return texts(n.props?.children);}
assert.equal(arcos('ContextProvider')[0].props.system,'ios');
assert.equal(arcos('NavBar').length,1);assert.equal(arcos('TabBar').length,1);
assert.ok(input('商品'));assert.ok(input('数量'));assert.ok(input('期望交期'));
assert.equal(arcos('Button').find(n=>texts(n)==='开始比价').props.disabled,true);
input('商品').props.onInput({},'自定义采购任务');refresh();
assert.equal(input('商品').props.value,'自定义采购任务');
const exampleButton=walk(tree).find(n=>n.type==='button'&&texts(n)==='查看示例报价');exampleButton.props.onClick();refresh();
assert.equal(window.YicaiCompare.getSnapshot().quotes.length,3);
assert.equal(texts(byLabel('瑞丰家居').props.children),'¥292.80 / 箱');
byLabel('比较币种').props.onClick();refresh();const before=window.YicaiCompare.getSnapshot().rates;
arcos('Picker')[0].props.onOk(['CNY']);refresh();assert.deepEqual(window.YicaiCompare.getSnapshot().rates,before);
arcos('Button').find(n=>texts(n)==='开始比价').props.onClick();refresh();
assert.equal(arcos('NavBar')[0].props.title,'比价结果');
assert.ok(byLabel('同条件合计最低'));assert.equal(byLabel('同条件合计最低').props.text,'暂不可排名');
assert.ok(walk(tree).some(n=>n.type==='section'&&n.props.className==='print-report'));
const completed=window.YicaiCompare.getSnapshot();
arcos('NavBar')[0].props.onClickLeft();refresh();
const draftTitle='未完成的新草稿';input('商品').props.onInput({},draftTitle);refresh();
arcos('TabBar')[0].props.onChange(1);refresh();
const historyRow=arcos('Cell').find(n=>n.props.label===completed.title);assert.ok(historyRow);historyRow.props.onClick();refresh();
assert.equal(arcos('NavBar')[0].props.title,'比价结果');
assert.equal(JSON.parse(storage.get('yicai-draft-v1')).title,draftTitle);
arcos('NavBar')[0].props.onClickLeft();refresh();
assert.ok(arcos('TabBar').length);assert.equal(arcos('TabBar')[0].props.activeIndex,1);
assert.equal(window.YicaiCompare.getSnapshot().title,draftTitle);
arcos('TabBar')[0].props.onChange(0);refresh();
byLabel('佳禾日用品').props.onClick();refresh();
assert.equal(arcos('NavBar')[0].props.title,'供应商报价');
assert.ok(input('单价'));assert.ok(input('名称'));
assert.equal(arcos('NavBar')[0].props.leftContent.props.disabled,undefined);
input('单价').props.onInput({},'11.80');refresh();assert.equal(input('单价').props.value,'11.80');
arcos('NavBar')[0].props.onClickRight();refresh();assert.equal(window.YicaiCompare.getSnapshot().quotes[0].price,'11.80');
byLabel('添加供应商报价').props.onClick();refresh();
assert.equal(arcos('ActionSheet')[0].props.visible,true);
const manual=arcos('ActionSheet')[0].props.items.find(x=>x.content==='手动填写');manual.onClick();refresh();
input('名称').props.onInput({},'手工供应商');refresh();input('单价').props.onInput({},'15');refresh();
assert.equal(arcos('Uploader').length,1);
assert.equal(arcos('Uploader')[0].props.limit,3);assert.ok(arcos('Uploader')[0].props.onMaxSizeExceed);
arcos('NavBar')[0].props.onClickRight();refresh();
assert.equal(window.YicaiCompare.getSnapshot().quotes.length,4);
assert.equal(window.YicaiCompare.version,'3.0.0');
console.log('PASS: Arco component wiring, grouped form controls, input state, raw unit display, existing currency/rates, comparisons, full print report, preserving drafts while opening history, correct back navigation, top Done/Cancel, ActionSheet and Uploader limits. (Component API test doubles; no browser visual claim.)');
