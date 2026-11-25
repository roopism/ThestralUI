// Public companion slots and helpers get individual compile-time examples too.
const pair = (value, invalid) => ({ accept: [value], reject: [invalid] });
export default {
  'primitives:Grid': pair('{children:<article/>,dir:"rtl"}', '{children:{invalid:true}}'),
  'navigation:Separator': pair('{orientation:"vertical"}', '{orientation:"diagonal"}'),
  'navigation:Trigger': pair(
    '{type:"submit",isPending:true,onPress:event=>event.pointerType}',
    '{type:"navigation"}',
  ),
  'navigation:DialogTrigger': pair(
    '{isOpen:true,onOpenChange:open=>{const value:boolean=open}}',
    '{isOpen:"yes"}',
  ),
  'navigation:Modal': pair(
    '{isDismissable:true,isKeyboardDismissDisabled:true}',
    '{isDismissable:"yes"}',
  ),
  'navigation:ModalOverlay': pair(
    '{isDismissable:true,shouldCloseOnInteractOutside:el=>el.matches("button")}',
    '{shouldCloseOnInteractOutside:(el:number)=>true}',
  ),
  'navigation:OverlayDialog': pair(
    '{role:"alertdialog","aria-label":"Confirm"}',
    '{role:"button"}',
  ),
  'forms:Input': pair(
    '{autoComplete:"email",onChange:e=>e.currentTarget.value}',
    '{maxLength:"ten"}',
  ),
  'forms:TextArea': pair(
    '{rows:4,maxLength:120,onChange:e=>e.currentTarget.value}',
    '{rows:"four"}',
  ),
  'forms:Label': pair('{htmlFor:"code",children:"Code"}', '{htmlFor:5}'),
  'forms:FieldError': pair(
    '{children:({validationErrors})=>validationErrors.join(" ")}',
    '{children:{invalid:true}}',
  ),
  'forms:Text': pair('{slot:"description",children:"Choose one"}', '{slot:5}'),
  'forms:Group': pair('{isInvalid:true,isReadOnly:true}', '{isInvalid:7}'),
  'forms:CheckboxGroup': pair('{value:["one"],onChange:values=>values.join(",")}', '{value:[1]}'),
  'forms:Radio': pair('{value:"north",isDisabled:true}', '{value:42}'),
  'forms:ToggleButtonGroup': pair(
    '{selectionMode:"multiple",orientation:"horizontal",selectedKeys:["one"]}',
    '{selectionMode:"none"}',
  ),
  'forms:ListBoxItem': pair('{id:"one",textValue:"Tokyo",isDisabled:true}', '{textValue:7}'),
  'forms:SelectValue': pair(
    '{children:({isPlaceholder})=>isPlaceholder?"Choose":"Selected"}',
    '{children:{invalid:true}}',
  ),
  'forms:SliderTrack': pair(
    '{children:({isDisabled})=>isDisabled?"Off":"On"}',
    '{children:{invalid:true}}',
  ),
  'forms:SliderThumb': pair('{index:1,"aria-label":"Maximum",name:"max"}', '{index:"last"}'),
  'forms:SliderFill': pair('{offset:1}', '{offset:"middle"}'),
  'forms:SliderOutput': pair(
    '{children:({state})=>state.getThumbValueLabel(0)}',
    '{children:{invalid:true}}',
  ),
  'forms:DateInput': pair(
    '{slot:"start",children:segment=><span>{segment.text}</span>}',
    '{children:"segments"}',
  ),
  'forms:DateSegment': pair('{children:({text})=>text}', '{segment:{invalid:true}}'),
  'forms:CalendarCell': pair('{children:({formattedDate})=>formattedDate}', '{date:"2026-01-12"}'),
  'forms:CalendarGrid': pair(
    '{weekdayStyle:"short",offset:{months:1}}',
    '{weekdayStyle:"compact"}',
  ),
  'forms:CalendarGridHeader': pair('{children:day=><th>{day}</th>}', '{children:42}'),
  'forms:CalendarHeaderCell': pair('{children:"Monday"}', '{children:{invalid:true}}'),
  'forms:CalendarGridBody': pair('{children:date=><td>{date.day}</td>}', '{children:true}'),
  'forms:RangeCalendar': pair(
    '{allowsNonContiguousRanges:true,isDateUnavailable:d=>d.day===3}',
    '{allowsNonContiguousRanges:"yes"}',
  ),
  'forms:Tag': pair('{id:"saved",textValue:"Saved filter",isDisabled:true}', '{textValue:4}'),
  'forms:TagList': pair(
    '{items:[{id:"saved"}],renderEmptyState:()=>"No filters"}',
    '{renderEmptyState:42}',
  ),
  'color:ColorSwatch': pair('{color:"#aabbcc",colorName:"Cloud"}', '{colorName:42}'),
  'color:ColorArea': pair(
    '{colorSpace:"hsl",xChannel:"saturation",yChannel:"lightness"}',
    '{xChannel:"colorName"}',
  ),
  'color:ColorThumb': pair('{children:<span/>}', '{children:{invalid:true}}'),
  'color:ColorSlider': pair(
    '{colorSpace:"hsl",channel:"hue",orientation:"vertical"}',
    '{channel:"gray-value"}',
  ),
  'color:ColorWheel': pair(
    '{innerRadius:48,outerRadius:56,defaultValue:"#bbccdd"}',
    '{innerRadius:"wide"}',
  ),
  'color:ColorWheelTrack': pair(
    '{style:{borderRadius:"50%"},ref:el=>{el?.getBoundingClientRect()}}',
    '{style:{borderRadius:true}}',
  ),
  'color:ColorSwatchPickerItem': pair('{color:"#aabbcc",isDisabled:true}', '{isDisabled:"yes"}'),
  'forms:DropZone': pair(
    '{isDisabled:false,onDrop:e=>{const length=e.items.length}}',
    '{isDisabled:"maybe"}',
  ),
  'forms:FileTrigger': pair(
    '{acceptedFileTypes:["image/png"],allowsMultiple:true,onSelect:files=>files?.item(0)}',
    '{acceptedFileTypes:"image/png"}',
  ),
  'navigation:Breadcrumb': pair('{id:"home",children:<a href="/">Home</a>}', '{id:{invalid:true}}'),
  'navigation:Link': pair('{href:"/records",isDisabled:false,target:"_self"}', '{href:7}'),
  'navigation:MenuItem': pair(
    '{id:"archive",textValue:"Archive",shouldCloseOnSelect:true}',
    '{textValue:4}',
  ),
  'navigation:MenuTrigger': pair('{trigger:"longPress",defaultOpen:false}', '{trigger:"hover"}'),
  'navigation:SubmenuTrigger': pair('{delay:250}', '{delay:"fast"}'),
  'navigation:TooltipTrigger': pair('{trigger:"focus",delay:120,closeDelay:180}', '{delay:"slow"}'),
  'navigation:Tab': pair('{id:"review",isDisabled:true,children:"Review"}', '{isDisabled:"yes"}'),
  'navigation:TabList': pair('{items:[{id:"review"}],dependencies:["en"]}', '{items:17}'),
  'navigation:TabPanel': pair('{id:"review",shouldForceMount:true}', '{shouldForceMount:"yes"}'),
  'navigation:DisclosureGroup': pair(
    '{allowsMultipleExpanded:true,expandedKeys:new Set(["one","two"])}',
    '{allowsMultipleExpanded:"yes"}',
  ),
  'navigation:DisclosurePanel': pair(
    '{role:"region",children:<section/>}',
    '{children:{invalid:true}}',
  ),
  'motion:createToastQueue': { mode: 'call', accept: ['2', ''], reject: ['"two"'] },
  'motion:captureSharedElement': {
    mode: 'call',
    accept: ['document.createElement("section")'],
    reject: ['{left:0,top:0,width:24,height:24}'],
  },
};
