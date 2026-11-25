// One reviewed accepted and rejected consumer per family root. Positive cases use public props,
// preserving contextual event types; negative cases guard overbroad or erased declarations.
const pair = (accept, reject) => ({ accept: [accept], reject: [reject] });
import { readFileSync } from 'node:fs';
import companions from './companion-cases.mjs';
const incumbentCases = {
  ...companions,
  'modes:ModeProvider': {
    accept: ['{brand:"expressive",scheme:"high-contrast",motion:"reduced",density:"spacious",children:<input/>}'],
    reject: ['{density:"wide"}', '{scheme:"automatic"}', '{motion:0}'],
  },
  'primitives:Box': pair('{dir:"rtl", ref: node=>{node?.focus()}}', '{ref:(value:number)=>{}}'),
  'primitives:Stack': {
    accept: [
      '{children:<button/>,ref:el=>el?.focus()}',
      '{gap:"sm",align:"start",justify:"end"}',
      '{gap:"lg",align:"center",justify:"center"}',
      '{gap:{base:"sm",wide:"lg"}}',
    ],
    reject: [
      '{children:{invalid:true}}',
      '{gap:17}',
      '{align:"backwards"}',
      '{justify:"backwards"}',
    ],
    jsx: ['<Subject gap="sm" align="center"><button>Keep focus</button></Subject>'],
  },
  'primitives:Inline': {
    accept: [
      '{children:<button/>,dir:"rtl"}',
      '{gap:"sm",align:"center",justify:"start",wrap:true}',
    ],
    reject: ['{children:{invalid:true}}', '{align:"backwards"}', '{gap:17}'],
  },
  'primitives:Surface': pair(
    '{dir:"rtl",children:<section>Summary</section>}',
    '{children:{invalid:true}}',
  ),
  'primitives:ScrollArea': pair('{label:"Timeline",tabIndex:0}', '{label:false}'),
  'primitives:Text': pair('{lang:"ja",children:"東京"}', '{children:{invalid:true}}'),
  '.:AdaptiveGrid': pair(
    '{children:[<article key="a">First</article>]}',
    '{children:{invalid:true}}',
  ),
  'primitives:Divider': pair('{"aria-orientation":"vertical"}', '{"aria-orientation":"diagonal"}'),
  'primitives:Icon': pair('{label:"Verified",children:<svg/>}', '{label:45}'),
  'primitives:Badge': pair(
    '{children:<strong>Delayed</strong>,dir:"rtl"}',
    '{children:{invalid:true}}',
  ),
  'avatar:Avatar': pair('{image:"photo.webp",name:"Ari",fallback:"AR"}', '{fallback:false}'),
  'primitives:Skeleton': pair('{"aria-hidden":true,inert:true}', '{inert:"maybe"}'),
  'primitives:Spinner': pair('{label:"Loading records"}', '{label:43}'),
  'primitives:Progress': pair(
    '{max:100,value:38,"aria-valuetext":"38 percent"}',
    '{value:{invalid:true}}',
  ),
  'primitives:Status': pair('{tone:"error",children:"Connection lost"}', '{tone:"random"}'),
  '.:Button': {
    accept: [
      '{type:"submit",tone:"secondary",busy:true,ref:el=>el?.focus()}',
      '{size:"sm",startIcon:<svg/>,endIcon:<svg/>}',
      '{size:"md",busy:true,motion:"press"}',
      '{size:"lg",type:"submit",tone:"secondary"}',
    ],
    reject: [
      '{size:"xxxl"}',
      '{startIcon:{invalid:true}}',
      '{endIcon:{invalid:true}}',
      '{busy:"yes"}',
    ],
    jsx: ['<Subject size="md" startIcon={<svg/>} endIcon={<svg/>}>Save</Subject>'],
  },
  'primitives:IconButton': {
    accept: [
      '{label:"Save",busy:true,children:<svg/>}',
      '{size:"sm",label:"Close",children:<svg/>}',
      '{size:"lg",busy:true,label:"Save"}',
    ],
    reject: ['{size:"xxxl"}', '{label:7}'],
    jsx: ['<Subject label="Save" size="md"><svg/></Subject>'],
    rejectJsx: ['<Subject size="md"><svg/></Subject>'],
  },
  'primitives:ButtonGroup': pair(
    '{label:"Workspace actions",children:<button>Save</button>}',
    '{label:7}',
  ),
  '.:FormField': pair(
    '{label:"Code",error:"Required",hint:"Four digits",children:<input/>}',
    '{label:false}',
  ),
  'dialog:Dialog': pair(
    '{labelledBy:"heading",role:"alertdialog",onDismiss:()=>{},dismissOnBackdrop:false}',
    '{role:"button"}',
  ),
  'native:Button': {
    prelude: ['import {Text} from "react-native";'],
    accept: [
      '{label:"Save",onPress:e=>e.nativeEvent,busy:true}',
      '{label:"Save",size:"sm",startIcon:<Text>✓</Text>,endIcon:<Text>→</Text>,onPress:event=>{event.nativeEvent}}',
      '{label:"Close",size:"lg",busy:true}',
    ],
    reject: [
      '{busy:"yes"}',
      '{size:"xxxl"}',
      '{startIcon:{invalid:true}}',
      '{endIcon:{invalid:true}}',
    ],
    jsx: ['<Subject size="md" label="Save" onPress={()=>{}}/>'],
  },
  'native:IconButton': {
    prelude: ['import {Text} from "react-native";'],
    accept: ['{label:"Close",icon:<Text>×</Text>,size:"lg",onPress:e=>e.nativeEvent}'],
    reject: ['{icon:42}', '{size:"xxxl"}'],
    jsx: ['<Subject icon={<Text>×</Text>} label="Close" onPress={()=>{}}/>'],
    rejectJsx: ['<Subject icon={<Text>×</Text>} onPress={()=>{}}/>'],
  },
  'native:FormField': pair(
    '{label:"Code",hint:"Four digits",onChangeText:value=>value.trim()}',
    '{onChangeText:(value:number)=>{}}',
  ),
  'native:Dialog': pair(
    '{title:"Archive",onDismiss:()=>{},children:"Confirm"}',
    '{onDismiss:true}',
  ),
  'forms:TextField': pair(
    '{value:"Ari",isRequired:true,onChange:value=>value.trim()}',
    '{onChange:(value:number)=>{}}',
  ),
  'forms:Form': pair(
    '{validationErrors:{code:"Required"},validationBehavior:"aria"}',
    '{validationBehavior:"automatic"}',
  ),
  'forms:SearchField': pair(
    '{value:"Tokyo",onClear:()=>{},onChange:q=>q.trim()}',
    '{onChange:(q:number)=>{}}',
  ),
  'forms:Checkbox': pair(
    '{isIndeterminate:true,isReadOnly:true,onChange:checked=>checked.valueOf()}',
    '{isIndeterminate:"mixed"}',
  ),
  'forms:RadioGroup': pair(
    '{orientation:"horizontal",value:"north",onChange:key=>key.trim()}',
    '{orientation:"diagonal"}',
  ),
  'forms:Switch': pair(
    '{defaultSelected:true,isReadOnly:true,onChange:value=>{const checked:boolean=value}}',
    '{isSelected:"yes"}',
  ),
  'forms:ToggleButton': pair(
    '{isSelected:true,onChange:value=>{const selected:boolean=value}}',
    '{isSelected:"yes"}',
  ),
  'forms:ListBox': pair(
    '{selectionMode:"multiple",disabledKeys:["pending"],selectedKeys:new Set(["one"]),renderEmptyState:()=>"No results"}',
    '{selectionMode:"all-items"}',
  ),
  'forms:Select': pair(
    '{selectedKey:"north",defaultSelectedKey:"north",placeholder:"Choose"}',
    '{selectedKey:{invalid:true}}',
  ),
  'forms:ComboBox': pair(
    '{allowsCustomValue:true,inputValue:"To",selectedKey:"tokyo",onInputChange:q=>q.trim()}',
    '{inputValue:23}',
  ),
  'forms:Autocomplete': pair(
    '{inputValue:"ja",onInputChange:q=>q.trim(),filter:(text,q)=>text.includes(q)}',
    '{onInputChange:(query:boolean)=>{}}',
  ),
  'forms:Slider': pair(
    '{value:[25,75],minValue:0,maxValue:100,step:5,orientation:"vertical",formatOptions:{style:"percent"}}',
    '{orientation:"diagonal"}',
  ),
  'forms:NumberField': pair(
    '{value:1.2,step:0.1,formatOptions:{style:"decimal"},minValue:0,maxValue:10}',
    '{step:"small"}',
  ),
  'forms:DateField': pair(
    '{granularity:"day",isRequired:true,isDateUnavailable:d=>d.month===1}',
    '{granularity:"decade"}',
  ),
  'forms:TimeField': pair('{hourCycle:24,granularity:"minute",isReadOnly:true}', '{hourCycle:16}'),
  'forms:Calendar': pair(
    '{visibleDuration:{months:2},isDateUnavailable:d=>d.day===13}',
    '{visibleDuration:{months:"two"}}',
  ),
  'forms:DatePicker': pair(
    '{isOpen:true,onOpenChange:open=>{const flag:boolean=open},granularity:"day"}',
    '{isOpen:"yes"}',
  ),
  'forms:DateRangePicker': pair(
    '{isRequired:true,allowsNonContiguousRanges:true,isDateUnavailable:d=>d.day===3}',
    '{allowsNonContiguousRanges:1}',
  ),
  'forms:TagGroup': pair(
    '{selectionMode:"multiple",onRemove:keys=>{for(const key of keys) String(key)}}',
    '{onRemove:(keys:boolean)=>{}}',
  ),
  'color:ColorField': pair(
    '{colorSpace:"hsl",channel:"hue",onChange:value=>value?.toString()}',
    '{channel:"brightness-as-text"}',
  ),
  'color:ColorPicker': pair(
    '{defaultValue:"#339966",onChange:value=>value.toString("hex")}',
    '{value:42}',
  ),
  'color:ColorSwatchPicker': pair(
    '{value:"#335599",onChange:value=>value.toString("hex")}',
    '{value:true}',
  ),
  'entry-fields:FileUpload': pair(
    '{label:"Attachment",accept:"image/*",multiple:true,onChange:event=>event.currentTarget.files}',
    '{value:"forced file"}',
  ),
  'entry-fields:PasswordField': pair(
    '{label:"Password",revealLabel:"Show",concealLabel:"Hide",autoComplete:"current-password"}',
    '{revealLabel:false}',
  ),
  'entry-fields:CodeField': pair(
    '{label:"Code",digits:4,autoComplete:"one-time-code"}',
    '{digits:"four"}',
  ),
  'entry-fields:ValidationSummary': pair(
    '{label:"Issues",errors:[{fieldId:"code",message:"Too short"}]}',
    '{errors:[{fieldId:5,message:"Bad"}]}',
  ),
  'navigation:Breadcrumbs': pair(
    '{isDisabled:true,children:<span>Root</span>}',
    '{isDisabled:"yes"}',
  ),
  'navigation:Toolbar': pair(
    '{orientation:"vertical","aria-label":"Actions"}',
    '{orientation:"diagonal"}',
  ),
  'navigation:Menu': pair(
    '{selectionMode:"single",selectedKeys:new Set(["save"]),disabledKeys:["delete"],onAction:key=>String(key)}',
    '{selectionMode:"all-items"}',
  ),
  'navigation:Tooltip': pair(
    '{placement:"top start",isOpen:true,shouldFlip:true}',
    '{placement:"top-left-corner"}',
  ),
  'navigation:Popover': pair(
    '{placement:"bottom end",isKeyboardDismissDisabled:false,shouldFlip:true}',
    '{placement:"here"}',
  ),
  'navigation:Tabs': pair(
    '{keyboardActivation:"manual",orientation:"vertical",disabledKeys:["pending"]}',
    '{keyboardActivation:"immediate"}',
  ),
  'navigation:Disclosure': pair(
    '{isExpanded:true,onExpandedChange:value=>{const expanded:boolean=value}}',
    '{onExpandedChange:(value:number)=>{}}',
  ),
  'document:Heading': pair('{level:2,children:"Activity",ref:node=>node?.focus()}', '{level:9}'),
  'document:Separator': pair('{orientation:"vertical","aria-label":"Chapter break"}', '{orientation:"diagonal"}'),
  'document:Keyboard': pair('{children:"⌘P","aria-label":"Print"}', '{"aria-label":5}'),
  'navigation:Heading': pair('{level:2,children:"Activity"}', '{level:"two"}'),
  'navigation:Keyboard': pair('{children:"⌘K","aria-label":"Command K"}', '{"aria-label":5}'),
  'navigation:I18nProvider': pair('{locale:"ar-EG",children:<span lang="ar"/>}', '{locale:123}'),
  'collections:DataTable': pair(
    '{label:"Records",pageSize:25,rows:[{id:"a"}],columns:[{id:"name",label:"Name",value:row=>row.id}],getRowLabel:row=>row.id,bulkAction:{label:"Archive",onApply:ids=>ids.join(",")}}',
    '{columns:[{id:"a",label:"Age",value:()=>({invalid:true})}]}',
  ),
  'collections:VirtualDataGrid': pair(
    '{rowHeight:48,selectionMode:"multiple",rows:[{id:"a"}],columns:[{id:"name",label:"Name",render:row=>row.id}]}',
    '{rowHeight:"large"}',
  ),
  'collections:VirtualTree': pair(
    '{expandedKeys:["parent"],disabledKeys:["closed"],items:[{id:"parent",label:"Parent",children:[]}]}',
    '{items:[{id:5,label:"Parent"}]}',
  ),
  'workflows:AppShell': pair(
    '{navigationLabel:"Workspace",skipLabel:"Skip",header:<h1>Home</h1>,navigation:<nav/>,children:<main/>}',
    '{skipLabel:true}',
  ),
  'workflows:AppNavigation': pair(
    '{currentId:"projects",items:[{id:"projects",label:"Projects",href:"/p"}],renderLink:(item,attrs)=><a {...attrs}>{item.label}</a>}',
    '{items:[{id:"a",href:false,label:"Home"}]}',
  ),
  'workflows:WorkspacePage': pair(
    '{title:"Review",description:<span>Details</span>,actions:<button>Save</button>}',
    '{title:7}',
  ),
  'workflows:RecordList': pair(
    '{label:"Records",selectedId:null,items:[{id:"a",label:"A",disabled:true}],onSelect:id=>id.trim()}',
    '{onSelect:(id:number)=>{}}',
  ),
  'workflows:SplitView': pair(
    '{defaultSize:0.4,resizeLabel:"Resize",list:<nav/>,detail:<section/>}',
    '{defaultSize:"wide"}',
  ),
  'workflows:Wizard': pair(
    '{activeId:"review",busy:false,steps:[{id:"review",label:"Review",content:<section/>,canAdvance:true}],onStepChange:id=>id.trim()}',
    '{steps:[{id:"a",label:2,content:null}]}',
  ),
  'workflows:CommandPalette': pair(
    '{commands:[{id:"new",label:"New",disabled:false}],locale:"en",onChoose:id=>id.trim(),returnFocusTo:document.body}',
    '{commands:[{id:2,label:"New"}]}',
  ),
  'workflows:NotificationCenter': pair(
    '{availability:{kind:"error",message:"Lost",retryLabel:"Retry",onRetry:()=>{}},items:[{id:"a",title:"News",read:false}]}',
    '{availability:{kind:"error",message:"Lost"}}',
  ),
  'workflows:SettingsPanel': pair(
    '{groups:[{id:"prefs",label:"Preferences",settings:[{id:"mail",label:"Email",enabled:true}]}],onChange:(id,on)=>{id.trim(); const enabled:boolean=on}}',
    '{onChange:(id:number,on:boolean)=>{}}',
  ),
  'workflows:BatchProgress': pair(
    '{items:[{id:"1",label:"Inspect",state:"failed"}],onRetry:id=>id.trim()}',
    '{items:[{id:"1",label:"Inspect",state:"unknown"}]}',
  ),
  'motion:Drawer': pair(
    '{placement:"end",title:"Tools",closeLabel:"Close",onDismiss:()=>{}}',
    '{placement:"center"}',
  ),
  'motion:GestureSheet': pair(
    '{title:"Options",closeLabel:"Close",onDismiss:()=>{},children:<main/>}',
    '{onDismiss:true}',
  ),
  'motion:AlertDialog': pair(
    '{title:"Delete",cancelLabel:"Cancel",confirmLabel:"Delete",onCancel:()=>{},onConfirm:()=>{}}',
    '{confirmLabel:7}',
  ),
  'motion:ToastRegion': pair(
    '{dismissLabel:"Close notification",label:"Alerts"}',
    '{queue:{invalid:true}}',
  ),
  'motion:Carousel': pair(
    '{items:[{id:"a",label:"A",content:<figure/>}],labels:{previous:"Prev",next:"Next",carousel:"Carousel",slide:"Slide",position:(i,n)=>i+"/"+n}}',
    '{items:[{id:5,label:"A",content:null}]}',
  ),
  'motion:ExpandableMediaCard': pair(
    '{animate:true,media:<figure/>,expandLabel:"Open",collapseLabel:"Close"}',
    '{animate:"yes"}',
  ),
  'motion:playMotionSequence': {
    mode: 'call',
    accept: [
      '[{element:document.body,preset:"spring"}],{stagger:20,signal:new AbortController().signal}',
    ],
    reject: ['[{element:document.body,preset:"dance"}]'],
  },
  'motion:animateSharedElement': {
    mode: 'call',
    accept: [
      '{left:1,top:0,width:14,height:24},document.body,{signal:new AbortController().signal}',
    ],
    reject: ['{left:"1px",top:0,width:14,height:24},document.body'],
  },
  'patterns:EmptyState': pair(
    '{title:"Nothing saved",headingLevel:3,description:"Try searching",action:<button>Search</button>}',
    '{headingLevel:7}',
  ),
  'patterns:PanelHeader': pair(
    '{children:[<h3 key="heading">Documents</h3>,<button key="action">Add</button>],role:"group"}',
    '{children:{invalid:true}}',
  ),
  'patterns:ResourceCard': pair(
    '{selected:true,actionLabel:"Save record",actionText:"Save",metadata:"Today",onSelectedChange:value=>{const flag:boolean=value}}',
    '{selected:"yes"}',
  ),
  'patterns:DocumentPreview': pair(
    '{label:"Report",children:<article>Preview</article>}',
    '{label:false}',
  ),
};

// Only JSON property examples enter the compiler. A manifest cannot supply a TypeScript directive,
// change an incumbent case, or attach its examples to another family's binding.
export function registeredConsumerCases(incumbent, families) {
  const result = { ...incumbent };
  for (const row of families) {
    for (const [binding, samples] of Object.entries(row.consumerTypes ?? {})) {
      if (!row.exports.includes(binding) || Object.hasOwn(result, binding))
        throw Error('Duplicate or unowned packed type case: ' + binding);
      if (Object.keys(samples).sort().join(',') !== 'accept,reject') throw Error('Invalid examples for ' + binding);
      const encoded = {};
      for (const kind of ['accept', 'reject']) {
        const values = samples[kind];
        if (!Array.isArray(values) || !values.length || !values.every(value =>
          value && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length))
          throw Error('Missing property examples for ' + binding);
        encoded[kind] = values.map(value => JSON.stringify(value));
      }
      result[binding] = encoded;
    }
  }
  return result;
}

const registry = JSON.parse(readFileSync(new URL('./families.json', import.meta.url)));
export const cases = registeredConsumerCases(incumbentCases, registry.families);
export const shippedMinimum = cases;

// The earlier package snapshots are exercised explicitly by upgrade regressions.
const beforeActionSizes = {
  '.:Button': pair(
    '{type:"submit",tone:"secondary",busy:true,ref:el=>el?.focus()}',
    '{busy:"yes"}',
  ),
  'native:Button': pair('{label:"Save",onPress:e=>e.nativeEvent,busy:true}', '{busy:"yes"}'),
  'primitives:IconButton': pair('{label:"Save",busy:true,children:<svg/>}', '{label:7}'),
  'primitives:Stack': pair('{children:<button/>,ref:el=>el?.focus()}', '{children:{invalid:true}}'),
  'primitives:Inline': pair('{children:<button/>,dir:"rtl"}', '{children:{invalid:true}}'),
};
export function consumerCases(target) {
  if (target === 'layout') return shippedMinimum;
  if (target === 'actions')
    return {
      ...shippedMinimum,
      'primitives:Stack': beforeActionSizes['primitives:Stack'],
      'primitives:Inline': beforeActionSizes['primitives:Inline'],
    };
  const { 'native:IconButton': introducedWithActions, ...earlier } = shippedMinimum;
  return { ...earlier, ...beforeActionSizes };
}
