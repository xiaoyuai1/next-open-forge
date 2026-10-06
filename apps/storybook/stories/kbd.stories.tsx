import { Kbd, KbdGroup } from "@repo/design-system/components/ui/kbd";
import type { Meta, StoryObj } from "@storybook/react";

const meta = {
  args: {},
  argTypes: {},
  component: Kbd,
  render: (args) => <Kbd {...args}>Ctrl</Kbd>,
  tags: ["autodocs"],
  title: "ui/Kbd",
} satisfies Meta<typeof Kbd>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Group: Story = {
  render: (args) => (
    <div className="flex flex-col items-center gap-4">
      <p className="text-muted-foreground text-sm">
        Use{" "}
        <KbdGroup>
          <Kbd {...args}>Ctrl + B</Kbd>
          <Kbd {...args}>Ctrl + K</Kbd>
        </KbdGroup>{" "}
        to open the command palette
      </p>
    </div>
  ),
};
