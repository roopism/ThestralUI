import { ColorField, ColorSwatch } from '@ui-lazy-dev/ui-web/color';
import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import {
  Calendar,
  CalendarCell,
  CalendarGrid,
  ComboBox,
  DateField,
  DateInput,
  DateSegment,
  Group,
  Input,
  Label,
  ListBox,
  ListBoxItem,
  NumberField,
  TagGroup,
  TagList,
  Tag,
  TimeField,
} from '@ui-lazy-dev/ui-web/forms';
import { Heading, Popover, Trigger } from '@ui-lazy-dev/ui-web/navigation';
import '@ui-lazy-dev/ui-web/controls.css';

const meta = { title: 'Molecules/Workspace authoring' } satisfies Meta;
export default meta;
export const Editor: StoryObj = {
  render: function Editor() {
    const [filters, setFilters] = useState(['Hiring', 'Design', 'Remote']);
    const [color, setColor] = useState('#28523D');
    return (
      <main className="catalog uld-controls">
        <h1>Publication settings</h1>
        <div className="component-grid">
          <section>
            <h2>Schedule</h2>
            <DateField>
              <Label>Publication date</Label>
              <DateInput>{(segment) => <DateSegment segment={segment} />}</DateInput>
            </DateField>
            <TimeField>
              <Label>Time</Label>
              <DateInput>{(segment) => <DateSegment segment={segment} />}</DateInput>
            </TimeField>
            <NumberField defaultValue={2} minValue={1} maxValue={20}>
              <Label>Editions</Label>
              <Group>
                <Trigger slot="decrement" aria-label="Fewer editions">
                  −
                </Trigger>
                <Input />
                <Trigger slot="increment" aria-label="More editions">
                  +
                </Trigger>
              </Group>
            </NumberField>
            <Calendar aria-label="Publication calendar">
              <header>
                <Trigger slot="previous" aria-label="Previous month">
                  ‹
                </Trigger>
                <Heading />
                <Trigger slot="next" aria-label="Next month">
                  ›
                </Trigger>
              </header>
              <CalendarGrid>{(date) => <CalendarCell date={date} />}</CalendarGrid>
            </Calendar>
          </section>
          <section>
            <h2>Presentation</h2>
            <ColorField
              value={color}
              onChange={(value) => {
                if (value) setColor(value.toString('hex'));
              }}
            >
              <Label>Accent color</Label>
              <Input />
            </ColorField>
            <ColorSwatch
              color={color}
              style={{ display: 'block', background: color, width: '3rem', height: '1rem' }}
            />
            <ComboBox>
              <Label>Audience</Label>
              <Group>
                <Input />
                <Trigger aria-label="Choose audience">⌄</Trigger>
              </Group>
              <Popover>
                <ListBox>
                  {['Members', 'Editors', 'Everyone'].map((label) => (
                    <ListBoxItem key={label} id={label}>
                      {label}
                    </ListBoxItem>
                  ))}
                </ListBox>
              </Popover>
            </ComboBox>
            <TagGroup
              aria-label="Topic filters"
              onRemove={(keys) =>
                setFilters((previous) => previous.filter((tag) => !keys.has(tag)))
              }
            >
              <TagList items={filters.map((value) => ({ id: value }))}>
                {(item) => (
                  <Tag textValue={item.id}>
                    {item.id}
                    <Trigger slot="remove" aria-label={'Remove ' + item.id}>
                      ×
                    </Trigger>
                  </Tag>
                )}
              </TagList>
            </TagGroup>
          </section>
        </div>
      </main>
    );
  },
};
