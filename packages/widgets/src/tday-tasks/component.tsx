"use client";

import { useState } from "react";
import {
  ActionIcon,
  Badge,
  Button,
  Center,
  Group,
  Paper,
  ScrollArea,
  Select,
  Stack,
  Text,
  Textarea,
  TextInput,
  ThemeIcon,
  Tooltip,
  UnstyledButton,
} from "@mantine/core";
import { DateTimePicker } from "@mantine/dates";
import { IconCheck, IconChecklist, IconPencil, IconPlus, IconTrash, IconX } from "@tabler/icons-react";
import dayjs from "dayjs";
import { Flag } from "lucide-react";

import { clientApi } from "@homarr/api/client";
import { useIntegrationsWithInteractAccess } from "@homarr/auth/client";
import type { TdayTask } from "@homarr/integrations";
import { showSuccessNotification } from "@homarr/notifications";
import { useScopedI18n } from "@homarr/translation/client";

import type { WidgetComponentProps } from "../definition";
import { getListIcon } from "./list-icons";

import "./tday-tasks.css";

export default function TdayTasksWidget({ options, integrationIds }: WidgetComponentProps<"tdayTasks">) {
  const t = useScopedI18n("widget.tdayTasks");
  const integrationId = integrationIds[0];

  if (!integrationId) {
    return (
      <Center h="100%">
        <Text c="dimmed" size="sm">
          {t("empty")}
        </Text>
      </Center>
    );
  }

  return <TdayTasksContent options={options} integrationId={integrationId} />;
}

interface TdayTasksContentProps {
  options: WidgetComponentProps<"tdayTasks">["options"];
  integrationId: string;
}

const TdayTasksContent = ({ options, integrationId }: TdayTasksContentProps) => {
  const t = useScopedI18n("widget.tdayTasks");
  const view = options.view;

  const [tasks, { refetch }] = clientApi.widget.tday.getTasks.useSuspenseQuery(
    { integrationId, view },
    {
      // Near real-time: background refresh + on focus (Tday has no push channel reachable here).
      refetchOnMount: false,
      refetchOnWindowFocus: true,
      refetchOnReconnect: true,
      refetchInterval: 30_000,
      retry: false,
    },
  );

  const sortedTasks = sortTasks(tasks, options.sort);

  const canInteract = useIntegrationsWithInteractAccess().some(({ id }) => id === integrationId);

  const [pendingId, setPendingId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [priority, setPriority] = useState<"Low" | "Medium" | "High">("Low");
  const [listId, setListId] = useState<string | null>(null);
  const [addDue, setAddDue] = useState<string | null>(null);

  const [editing, setEditing] = useState<TdayTask | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editPriority, setEditPriority] = useState<"Low" | "Medium" | "High">("Low");
  const [editListId, setEditListId] = useState<string | null>(null);
  const [editDue, setEditDue] = useState<string | null>(null);
  const [editError, setEditError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Lists for the chosen view (todo-lists, or floater-lists for the floater view).
  // Fetched once the add or edit panel is opened.
  const listsQuery = clientApi.widget.tday.getLists.useQuery(
    { integrationId, view },
    { enabled: adding || editing !== null, refetchOnWindowFocus: false, retry: false },
  );
  const listOptions = (listsQuery.data ?? []).map((list) => ({ value: list.id, label: list.name }));
  const listById = new Map((listsQuery.data ?? []).map((list) => [list.id, list]));

  const completeMutation = clientApi.widget.tday.complete.useMutation();
  const uncompleteMutation = clientApi.widget.tday.uncomplete.useMutation();
  const deleteMutation = clientApi.widget.tday.delete.useMutation({
    onSuccess: () => {
      setEditing(null);
      setConfirmDelete(false);
      void refetch();
    },
    onError: (error) => setEditError(error.message || "Failed to delete task"),
  });
  const quickAddMutation = clientApi.widget.tday.quickAdd.useMutation({
    onSuccess: (result) => {
      void refetch();
      if (result.failedTitles.length > 0) {
        // Keep only the failed lines in the box so the user can retry them.
        setDraft(result.failedTitles.join("\n"));
        setAddError(t("addPartialFailed", { count: result.failedTitles.length }));
        return;
      }
      setDraft("");
      setAddError(null);
      setAdding(false);
    },
    onError: (error) => setAddError(error.message || "Failed to add tasks"),
  });
  const updateMutation = clientApi.widget.tday.update.useMutation({
    onSuccess: () => {
      setEditing(null);
      setEditError(null);
      void refetch();
    },
    onError: (error) => setEditError(error.message || "Failed to save task"),
  });

  // Keep the checkbox in its "loading" (dark green) state through both the complete request
  // and the subsequent list reload, so it doesn't flash back before the row disappears.
  const handleComplete = async (task: TdayTask) => {
    setPendingId(task.id);
    try {
      await completeMutation.mutateAsync({
        integrationId,
        id: task.id,
        kind: task.kind,
        instanceDate: task.instanceDate,
      });
      await refetch();
      showSuccessNotification({
        autoClose: 6000,
        message: (
          <Group justify="space-between" wrap="nowrap" gap="sm">
            <Text size="sm">{t("completedToast")}</Text>
            <Button
              size="compact-xs"
              variant="subtle"
              onClick={() => {
                void (async () => {
                  await uncompleteMutation.mutateAsync({
                    integrationId,
                    id: task.id,
                    kind: task.kind,
                    instanceDate: task.instanceDate,
                  });
                  await refetch();
                })();
              }}
            >
              {t("undo")}
            </Button>
          </Group>
        ),
      });
    } catch {
      // leave the task in place on failure
    } finally {
      setPendingId(null);
    }
  };

  const titlesFromDraft = () =>
    draft
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0);

  const handleQuickAdd = () => {
    const titles = titlesFromDraft();
    if (titles.length === 0) return;
    setAddError(null);
    quickAddMutation.mutate({ integrationId, view, titles, priority, listId, due: toTdayDue(addDue) });
  };

  const cancelAdd = () => {
    setAdding(false);
    setDraft("");
    setAddError(null);
    setAddDue(null);
  };

  const normalizePriority = (value: string): "Low" | "Medium" | "High" =>
    value === "Medium" || value === "High" ? value : "Low";

  const startEdit = (task: TdayTask) => {
    cancelAdd();
    setEditing(task);
    setEditTitle(task.title);
    setEditPriority(normalizePriority(task.priority));
    setEditListId(task.listId);
    setEditDue(task.due ? task.due.replace("T", " ") : null);
    setEditError(null);
    setConfirmDelete(false);
  };

  const cancelEdit = () => {
    setEditing(null);
    setEditError(null);
    setConfirmDelete(false);
  };

  const handleEditSave = () => {
    if (!editing) return;
    const title = editTitle.trim();
    if (!title) return;
    setEditError(null);
    updateMutation.mutate({
      integrationId,
      kind: editing.kind,
      id: editing.id,
      title,
      priority: editPriority,
      listId: editListId,
      due: toTdayDue(editDue),
    });
  };

  const handleDelete = () => {
    if (!editing) return;
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    deleteMutation.mutate({ integrationId, kind: editing.kind, id: editing.id, instanceDate: editing.instanceDate });
  };

  // Reusable priority/list selects (shared by the add and edit panels).
  const prioritySelect = (value: "Low" | "Medium" | "High", onChange: (next: "Low" | "Medium" | "High") => void, disabled: boolean) => (
    <Select
      size="xs"
      radius="md"
      label={t("priority")}
      value={value}
      onChange={(next) => onChange((next as "Low" | "Medium" | "High" | null) ?? "Low")}
      data={[
        { value: "Low", label: t("priorityNormal") },
        { value: "Medium", label: t("priorityImportant") },
        { value: "High", label: t("priorityUrgent") },
      ]}
      allowDeselect={false}
      leftSection={priorityFlag(value, { forMenu: true })}
      renderOption={({ option }) => (
        <Group gap="xs" wrap="nowrap">
          {priorityFlag(option.value, { forMenu: true })}
          <span>{option.label}</span>
        </Group>
      )}
      comboboxProps={{ withinPortal: true }}
      disabled={disabled}
    />
  );

  const listSelect = (value: string | null, onChange: (next: string | null) => void, disabled: boolean) => (
    <Select
      size="xs"
      radius="md"
      label={t("list")}
      value={value}
      onChange={onChange}
      data={listOptions}
      placeholder={listsQuery.isLoading ? t("listLoading") : t("listNone")}
      clearable
      searchable
      nothingFoundMessage={t("listNone")}
      leftSection={value ? listIcon(listById.get(value)?.iconKey ?? null, listById.get(value)?.color ?? null) : undefined}
      renderOption={({ option }) => {
        const meta = listById.get(option.value);
        return (
          <Group gap="xs" wrap="nowrap">
            {listIcon(meta?.iconKey ?? null, meta?.color ?? null)}
            <span>{option.label}</span>
          </Group>
        );
      }}
      comboboxProps={{ withinPortal: true }}
      disabled={disabled}
    />
  );

  const duePicker = (value: string | null, onChange: (next: string | null) => void, disabled: boolean) => (
    <DateTimePicker
      size="xs"
      radius="md"
      label={t("due")}
      value={value}
      onChange={onChange}
      clearable
      valueFormat="MMM D, YYYY · HH:mm"
      placeholder={t("dueNone")}
      popoverProps={{ withinPortal: true }}
      disabled={disabled}
    />
  );

  // Dated views reserve a fixed-width column so every due value lines up and the icons after it
  // stay aligned across rows. Floater has no due, so no column is reserved.
  const renderDue = (task: TdayTask) => {
    if (view === "floater") return null;
    const label = task.due ? (formatDue(task.due) ?? "") : "";
    return (
      <Text
        size="xs"
        c={view === "overdue" ? "red" : "dimmed"}
        ta="right"
        style={{ width: 54, flexShrink: 0, whiteSpace: "nowrap" }}
      >
        {label}
      </Text>
    );
  };

  // Priority flag: colored+filled for Important/Urgent. Normal shows a muted outline flag in
  // menus (so every option has a marker) but nothing in the compact task rows (matches the app).
  const priorityFlag = (value: string, { forMenu = false }: { forMenu?: boolean } = {}) => {
    const meta = PRIORITY_META[value] ?? PRIORITY_META.Low;
    if (meta.flag) return <Flag size={15} color={meta.flag} fill={meta.flag} />;
    return forMenu ? <Flag size={15} color="var(--mantine-color-dimmed)" /> : null;
  };

  const listIcon = (iconKey: string | null, color: string | null, size = 15) => {
    const Icon = getListIcon(iconKey);
    return <Icon size={size} color={color ?? "var(--mantine-color-dimmed)"} />;
  };

  return (
    <Stack h="100%" gap="sm" p="sm">
      <Group justify="space-between" align="center" gap="xs" wrap="nowrap">
        <Group gap={8} wrap="nowrap" align="center" style={{ minWidth: 0 }}>
          <Text size="sm" fw={700} truncate>
            {t(`option.view.option.${view}.title`)}
          </Text>
          <Badge size="sm" radius="sm" variant="light" color="gray">
            {sortedTasks.length}
          </Badge>
        </Group>
      </Group>
      {canInteract && editing ? (
        <Paper withBorder radius="md" p="sm">
          <Stack gap="xs">
            <Group justify="space-between" align="center">
              <Text size="xs" fw={700} c="dimmed" tt="uppercase">
                {t("editTask")}
              </Text>
              <ActionIcon size="sm" variant="subtle" color="gray" onClick={cancelEdit} aria-label={t("cancel")}>
                <IconX size={14} />
              </ActionIcon>
            </Group>
            <TextInput
              data-autofocus
              size="xs"
              radius="md"
              value={editTitle}
              onChange={(event) => setEditTitle(event.currentTarget.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  handleEditSave();
                }
              }}
              placeholder={t("quickAddPlaceholder")}
              disabled={updateMutation.isPending}
            />
            <Group gap="xs" grow align="flex-start">
              {prioritySelect(editPriority, setEditPriority, updateMutation.isPending)}
              {listSelect(editListId, setEditListId, updateMutation.isPending)}
            </Group>
            {editing.kind !== "floater" && duePicker(editDue, setEditDue, updateMutation.isPending)}
            {editError && (
              <Text size="xs" c="red">
                {editError}
              </Text>
            )}
            <Group gap="xs" justify="space-between" wrap="nowrap">
              <Button
                size="xs"
                radius="md"
                variant="subtle"
                color="red"
                leftSection={<IconTrash size={14} />}
                onClick={handleDelete}
                loading={deleteMutation.isPending}
              >
                {confirmDelete ? t("confirmDelete") : t("delete")}
              </Button>
              <Group gap="xs" wrap="nowrap">
                <Button size="xs" radius="md" variant="default" onClick={cancelEdit} disabled={updateMutation.isPending}>
                  {t("cancel")}
                </Button>
                <Button
                  size="xs"
                  radius="md"
                  leftSection={<IconCheck size={14} />}
                  onClick={handleEditSave}
                  loading={updateMutation.isPending}
                  disabled={!editTitle.trim()}
                >
                  {t("save")}
                </Button>
              </Group>
            </Group>
          </Stack>
        </Paper>
      ) : options.showQuickAdd && canInteract ? (
        adding ? (
          <Paper withBorder radius="md" p="sm">
            <Stack gap="xs">
              <Group justify="space-between" align="center">
                <Text size="xs" fw={700} c="dimmed" tt="uppercase">
                  {t("newTask")}
                </Text>
                <ActionIcon size="sm" variant="subtle" color="gray" onClick={cancelAdd} aria-label={t("cancel")}>
                  <IconX size={14} />
                </ActionIcon>
              </Group>
              <Textarea
                data-autofocus
                autosize
                minRows={1}
                maxRows={6}
                size="xs"
                radius="md"
                value={draft}
                onChange={(event) => setDraft(event.currentTarget.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
                    event.preventDefault();
                    handleQuickAdd();
                  }
                }}
                placeholder={t("quickAddPlaceholder")}
                disabled={quickAddMutation.isPending}
              />
              <Group gap="xs" grow align="flex-start">
                {prioritySelect(priority, setPriority, quickAddMutation.isPending)}
                {listSelect(listId, setListId, quickAddMutation.isPending)}
              </Group>
              {view !== "floater" && duePicker(addDue, setAddDue, quickAddMutation.isPending)}
              {addError && (
                <Text size="xs" c="red">
                  {addError}
                </Text>
              )}
              <Group gap="xs" justify="flex-end">
                <Button size="xs" radius="md" variant="default" onClick={cancelAdd} disabled={quickAddMutation.isPending}>
                  {t("cancel")}
                </Button>
                <Button
                  size="xs"
                  radius="md"
                  leftSection={<IconPlus size={14} />}
                  onClick={handleQuickAdd}
                  loading={quickAddMutation.isPending}
                  disabled={titlesFromDraft().length === 0}
                >
                  {t("quickAdd")}
                </Button>
              </Group>
            </Stack>
          </Paper>
        ) : (
          <Button
            size="xs"
            radius="md"
            variant="light"
            leftSection={<IconPlus size={14} />}
            onClick={() => setAdding(true)}
            fullWidth
          >
            {t("quickAdd")}
          </Button>
        )
      ) : null}
      <ScrollArea style={{ flex: 1 }} type="auto" offsetScrollbars="y">
        {sortedTasks.length === 0 ? (
          <Center h="100%">
            <Stack align="center" gap={6}>
              <ThemeIcon variant="light" color="gray" radius="xl" size="lg">
                <IconChecklist size={18} />
              </ThemeIcon>
              <Text c="dimmed" size="sm">
                {t("empty")}
              </Text>
            </Stack>
          </Center>
        ) : (
          <Stack gap={2}>
            {sortedTasks.map((task) => (
              <Group
                key={`${task.kind}-${task.id}-${task.instanceDate ?? task.due ?? ""}`}
                className="tday-task-row"
                gap="xs"
                wrap="nowrap"
                align="flex-start"
                justify="space-between"
              >
                <Group gap="sm" wrap="nowrap" align="flex-start" style={{ minWidth: 0, flex: 1 }}>
                  {options.showCompleteButton && canInteract && (
                    <UnstyledButton
                      className="tday-task-check"
                      data-loading={pendingId === task.id ? "true" : undefined}
                      onClick={() => handleComplete(task)}
                      disabled={pendingId === task.id}
                      aria-label={t("complete")}
                      style={{ marginTop: 2 }}
                    >
                      <IconCheck size={12} stroke={3} />
                    </UnstyledButton>
                  )}
                  <Text size="sm" fw={500} style={{ flex: 1, overflowWrap: "anywhere" }}>
                    {task.title}
                  </Text>
                </Group>
                <Group gap={8} wrap="nowrap" align="center" style={{ flexShrink: 0, marginTop: 1 }}>
                  {renderDue(task)}
                  <span style={{ width: 18, display: "inline-flex", justifyContent: "center", flexShrink: 0 }}>
                    {task.listName ? (
                      <Tooltip label={task.listName} withinPortal openDelay={300}>
                        <span style={{ display: "inline-flex" }} aria-label={task.listName}>
                          {listIcon(task.listIconKey, task.listColor, 16)}
                        </span>
                      </Tooltip>
                    ) : null}
                  </span>
                  <span style={{ width: 16, display: "inline-flex", justifyContent: "center", flexShrink: 0 }}>
                    {priorityFlag(task.priority)}
                  </span>
                  {canInteract && (
                    <ActionIcon
                      className="tday-task-edit"
                      size="sm"
                      variant="subtle"
                      color="gray"
                      radius="xl"
                      onClick={() => startEdit(task)}
                      aria-label={t("editTask")}
                    >
                      <IconPencil size={14} />
                    </ActionIcon>
                  )}
                </Group>
              </Group>
            ))}
          </Stack>
        )}
      </ScrollArea>
    </Stack>
  );
};

// Tday stores Low/Medium/High; the app surfaces these as Normal/Important/Urgent and shows a
// filled flag only for Important (orange) / Urgent (red). `flag` null = no flag in task rows.
const PRIORITY_META: Record<string, { key: "priorityNormal" | "priorityImportant" | "priorityUrgent"; flag: string | null }> = {
  Low: { key: "priorityNormal", flag: null },
  Medium: { key: "priorityImportant", flag: "var(--mantine-color-orange-6)" },
  High: { key: "priorityUrgent", flag: "var(--mantine-color-red-6)" },
};

const PRIORITY_RANK: Record<string, number> = { High: 0, Medium: 1, Low: 2 };

// Mantine date pickers emit "YYYY-MM-DD HH:mm"; Tday expects an ISO local datetime ("…THH:mm").
const toTdayDue = (value: string | null): string | null => (value ? value.replace(" ", "T") : null);

const formatDue = (due: string): string | null => {
  const parsed = dayjs(due);
  if (!parsed.isValid()) return null;
  return parsed.format("YYYY-MM-DD") === dayjs().format("YYYY-MM-DD") ? parsed.format("HH:mm") : parsed.format("MMM D");
};

const sortTasks = (tasks: TdayTask[], sort: string): TdayTask[] => {
  if (sort === "priority") {
    return [...tasks].sort((a, b) => (PRIORITY_RANK[a.priority] ?? 9) - (PRIORITY_RANK[b.priority] ?? 9));
  }
  if (sort === "due") {
    return [...tasks].sort((a, b) => (a.due ?? "~").localeCompare(b.due ?? "~"));
  }
  return tasks;
};
