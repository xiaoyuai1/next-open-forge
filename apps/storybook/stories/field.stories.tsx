import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldSet,
} from "@repo/design-system/components/ui/field";
import { Input } from "@repo/design-system/components/ui/input";
import type { Meta, StoryObj } from "@storybook/react";

const meta = {
  args: {},
  argTypes: {},
  component: FieldSet,
  render: (args) => (
    <FieldSet className="w-full max-w-xs" {...args}>
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="username">Username</FieldLabel>
          <Input id="username" placeholder="Max Leiter" type="text" />
          <FieldDescription>
            Choose a unique username for your account.
          </FieldDescription>
        </Field>
        <Field>
          <FieldLabel htmlFor="password">Password</FieldLabel>
          <FieldDescription>
            Must be at least 8 characters long.
          </FieldDescription>
          <Input id="password" placeholder="••••••••" type="password" />
        </Field>
      </FieldGroup>
    </FieldSet>
  ),
  tags: ["autodocs"],
  title: "ui/Field",
} satisfies Meta<typeof FieldSet>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};
