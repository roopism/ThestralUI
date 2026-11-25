import { useState } from 'react';
import '@ui-lazy-dev/ui-web/controls.css';
import type { Meta, StoryObj } from '@storybook/react-vite';
import {
  Checkbox,
  CheckboxGroup,
  Input,
  Label,
  Radio,
  RadioGroup,
  SearchField,
  Switch,
} from '@ui-lazy-dev/ui-web/forms';
import { I18nProvider, Tab, TabList, TabPanel, Tabs } from '@ui-lazy-dev/ui-web/navigation';

const meta = { title: 'Molecules/Preferences' } satisfies Meta;
export default meta;

function Preferences({ locale, labels }: { locale: string; labels: readonly string[] }) {
  const [settings, channels, email, density, compact, spacious, search, alerts, updates] = labels;
  const [changed, setChanged] = useState(false);
  const date = new Intl.DateTimeFormat(locale, { dateStyle: 'long', timeZone: 'UTC' }).format(
    new Date('2026-11-20T12:00:00Z'),
  );
  const count = new Intl.NumberFormat(locale).format(1250);
  return (
    <I18nProvider locale={locale}>
      <main lang={locale} dir={locale === 'ar' ? 'rtl' : 'ltr'} className="catalog uld-controls">
        <h1>{settings}</h1>
        <Tabs>
          <TabList aria-label={settings}>
            <Tab id="channels">{channels}</Tab>
            <Tab id="density">{density}</Tab>
          </TabList>
          <TabPanel id="channels">
            <SearchField>
              <Label>{search}</Label>
              <Input />
            </SearchField>
            <CheckboxGroup aria-label={channels} onChange={() => setChanged(true)}>
              <Checkbox value="email">{email}</Checkbox>
            </CheckboxGroup>
            <Switch>{alerts}</Switch>
            <p role="status">{changed && updates}</p>
            <small>
              <time dateTime="2026-11-20">{date}</time> · {count}
            </small>
          </TabPanel>
          <TabPanel id="density">
            <RadioGroup aria-label={density} defaultValue="dense">
              <Radio value="dense">{compact}</Radio>
              <Radio value="space">{spacious}</Radio>
            </RadioGroup>
          </TabPanel>
        </Tabs>
      </main>
    </I18nProvider>
  );
}
export const English: StoryObj = {
  render: () => (
    <Preferences
      locale="en"
      labels={[
        'Preferences',
        'Channels',
        'Email',
        'Density',
        'Compact',
        'Spacious',
        'Filter channels',
        'Alerts',
        'Changes apply to this workspace',
      ]}
    />
  ),
};
export const Arabic: StoryObj = {
  render: () => (
    <Preferences
      locale="ar"
      labels={[
        'التفضيلات',
        'القنوات',
        'البريد الإلكتروني',
        'الكثافة',
        'متقارب',
        'واسع',
        'تصفية القنوات',
        'التنبيهات',
        'تُطبق التغييرات على مساحة العمل هذه',
      ]}
    />
  ),
};
export const Japanese: StoryObj = {
  render: () => (
    <Preferences
      locale="ja"
      labels={[
        '設定',
        '通知チャネル',
        'メール',
        '表示密度',
        'コンパクト',
        'ゆったり',
        'チャネルを検索',
        '通知',
        '変更はこのワークスペースに適用されます',
      ]}
    />
  ),
};

export const Expanded: StoryObj = {
  render: () => (
    <Preferences
      locale="en-XA"
      labels={[
        '［Åççøüñţ þŕëƒëŕëñçëš］',
        '［Notifications and communications］',
        '［Email delivery preferences］',
        '［Workspace information density］',
        '［Compact presentation］',
        '［Spacious presentation］',
        '［Search every available notification channel］',
        '［Receive workspace alerts］',
        '［Your notification preferences have been updated］',
      ]}
    />
  ),
};
