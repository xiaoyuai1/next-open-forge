import { Button } from "@repo/design-system/components/ui/button";
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemTitle,
} from "@repo/design-system/components/ui/item";
import type { Meta, StoryObj } from "@storybook/react";

const meta = {
  args: {
    size: "default",
    variant: "default",
  },
  argTypes: {
    size: {
      control: {
        type: "select",
      },
      options: ["default", "sm", "xs"],
    },
    variant: {
      control: {
        type: "select",
      },
      options: ["default", "outline", "muted"],
    },
  },
  component: ItemGroup,
  render: (args) => (
    <Item {...args}>
      <ItemContent>
        <ItemTitle>Basic Item</ItemTitle>
        <ItemDescription>
          A simple item with title and description.
        </ItemDescription>
      </ItemContent>
      <ItemActions>
        <Button size="sm" variant="outline">
          Action
        </Button>
      </ItemActions>
    </Item>
  ),
  tags: ["autodocs"],
  title: "ui/Item",
} satisfies Meta<typeof Item>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};
