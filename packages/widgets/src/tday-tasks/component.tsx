"use client";

import type { CSSProperties, ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import {
  ActionIcon,
  Button,
  Center,
  Group,
  ScrollArea,
  Select,
  Stack,
  Text,
  TextInput,
  Tooltip,
  UnstyledButton,
} from "@mantine/core";
import { DateTimePicker } from "@mantine/dates";
import { IconCalendarEvent, IconCheck, IconPencil, IconPlus, IconTrash, IconX } from "@tabler/icons-react";
import dayjs from "dayjs";
import { CalendarClock, Clock3, Flag, Leaf, type LucideIcon, Moon, Sun } from "lucide-react";

import { clientApi } from "@homarr/api/client";
import { useIntegrationsWithInteractAccess } from "@homarr/auth/client";
import type { TdayTask } from "@homarr/integrations";
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
      // Near real-time: background poll + on focus (Tday has no push channel reachable here).
      refetchOnMount: false,
      refetchOnWindowFocus: true,
      refetchOnReconnect: true,
      refetchInterval: 15_000,
      retry: false,
    },
  );

  const sortedTasks = sortTasks(tasks, options.sort);

  const canInteract = useIntegrationsWithInteractAccess().some(({ id }) => id === integrationId);

  // A task can move between views (e.g. giving a scheduled task a due date of today), so any change
  // here invalidates every mounted Tday widget — sibling views update without waiting for the poll.
  const utils = clientApi.useUtils();
  const invalidateAll = () => void utils.widget.tday.getTasks.invalidate();
  // Complete/undo already await refetch() for the current view; only the sibling views still
  // need refreshing, so skip the current one to avoid a redundant second fetch of it.
  const invalidateSiblings = () =>
    void utils.widget.tday.getTasks.invalidate(undefined, {
      predicate: (query) => (query.queryKey[1] as { input?: { view?: string } } | undefined)?.input?.view !== view,
    });

  // Per-view identity mirrors the native app widgets: an accent colour + a faint background
  // watermark. Today swaps sun/moon by time of day; resolved after mount to avoid an SSR mismatch.
  const [isNight, setIsNight] = useState(false);
  useEffect(() => {
    const hour = new Date().getHours();
    setIsNight(hour < 6 || hour >= 18);
  }, []);
  const identity = resolveViewIdentity(view, isNight);
  const HeaderIcon = identity.HeaderIcon;

  // Completion feedback lives inside this widget (not Homarr's global corner) so it reads as part
  // of the list it came from. Auto-dismisses; a fresh completion restarts the timer via `nonce`.
  const [toast, setToast] = useState<{
    id: string;
    kind: TdayTask["kind"];
    instanceDate: string | null;
    nonce: number;
  } | null>(null);
  const toastNonce = useRef(0);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 6000);
    return () => clearTimeout(timer);
  }, [toast]);

  // Escape closes a composer from the keyboard; without an explicit target, focus would drop to
  // <body> on unmount. The ghost add row occupies the same slot; the widget root is the fallback.
  const rootRef = useRef<HTMLDivElement>(null);
  const ghostAddRef = useRef<HTMLButtonElement>(null);
  const restoreFocus = () => {
    requestAnimationFrame(() => (ghostAddRef.current ?? rootRef.current)?.focus());
  };
  // Focus the composer's input the moment it opens, so one tap on the ghost row (or the pencil) is
  // enough to start typing. Mantine's data-autofocus only fires inside a focus trap, so do it here.
  const draftInputRef = useRef<HTMLInputElement>(null);
  const editInputRef = useRef<HTMLInputElement>(null);

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

  useEffect(() => {
    if (adding) draftInputRef.current?.focus();
  }, [adding]);
  useEffect(() => {
    if (editing) editInputRef.current?.focus();
  }, [editing]);

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
      invalidateAll();
    },
    onError: (error) => setEditError(error.message || "Failed to delete task"),
  });
  const quickAddMutation = clientApi.widget.tday.quickAdd.useMutation({
    onSuccess: (result) => {
      invalidateAll();
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
      invalidateAll();
    },
    onError: (error) => setEditError(error.message || "Failed to save task"),
  });

  // Keep the row in its "completing" state (filled check, struck title, dimmed row) through both
  // the complete request and the subsequent list reload, so it doesn't flash back before it leaves.
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
      invalidateSiblings();
      toastNonce.current += 1;
      setToast({ id: task.id, kind: task.kind, instanceDate: task.instanceDate, nonce: toastNonce.current });
    } catch {
      // leave the task in place on failure
    } finally {
      setPendingId(null);
    }
  };

  // Undo the completion that the in-widget toast refers to, then dismiss it.
  const handleUndo = async () => {
    if (!toast) return;
    const target = toast;
    setToast(null);
    try {
      await uncompleteMutation.mutateAsync({
        integrationId,
        id: target.id,
        kind: target.kind,
        instanceDate: target.instanceDate,
      });
      await refetch();
      invalidateSiblings();
    } catch {
      // if undo fails, the task stays completed
    }
  };

  // One task is a single line — Enter submits it. (No multi-line entry; see native/web parity.)
  const handleQuickAdd = () => {
    const title = draft.trim();
    if (!title) return;
    setAddError(null);
    quickAddMutation.mutate({ integrationId, view, titles: [title], priority, listId, due: toTdayDue(addDue) });
  };

  // The add/save button takes the selected list's colour, falling back to the per-view accent.
  const submitButtonStyle = (selectedListId: string | null): CSSProperties => {
    const bg = (selectedListId ? listById.get(selectedListId)?.color : null) ?? "var(--tday-accent)";
    return {
      "--button-bg": bg,
      "--button-hover": `color-mix(in srgb, ${bg} 86%, #000)`,
      "--button-color": "#fff",
    } as CSSProperties;
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

  // Reusable priority/list selects (shared by the add and edit panels). Label-less inside the
  // composer's controls strip; flex-basis lets the three controls share a row or wrap when narrow.
  const prioritySelect = (
    value: "Low" | "Medium" | "High",
    onChange: (next: "Low" | "Medium" | "High") => void,
    disabled: boolean,
  ) => (
    <Select
      size="xs"
      radius="md"
      aria-label={t("priority")}
      style={{ flex: "1 1 96px", minWidth: 0 }}
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
      aria-label={t("list")}
      style={{ flex: "1 1 110px", minWidth: 0 }}
      value={value}
      onChange={onChange}
      data={listOptions}
      placeholder={listsQuery.isLoading ? t("listLoading") : t("list")}
      clearable
      searchable
      nothingFoundMessage={t("listNone")}
      leftSection={
        value ? listIcon(listById.get(value)?.iconKey ?? null, listById.get(value)?.color ?? null) : undefined
      }
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
      aria-label={t("due")}
      style={{ flex: "1 1 130px", minWidth: 0 }}
      leftSection={<IconCalendarEvent size={13} />}
      value={value}
      onChange={onChange}
      clearable
      valueFormat="MMM D, YYYY · HH:mm"
      placeholder={t("due")}
      popoverProps={{ withinPortal: true }}
      disabled={disabled}
    />
  );

  // Humanized due label + semantic tone. Today/Tomorrow/weekday for the near future, dates beyond.
  const formatDue = (due: string): { label: string; tone: "overdue" | "today" | "future" } | null => {
    const parsed = dayjs(due);
    if (!parsed.isValid()) return null;
    const now = dayjs();
    const today = now.startOf("day");
    const day = parsed.startOf("day");
    const dateLabel = day.year() === today.year() ? parsed.format("MMM D") : parsed.format("MMM [’]YY");
    if (day.isBefore(today)) return { label: dateLabel, tone: "overdue" };
    if (day.isSame(today)) {
      // Tday defaults date-only tasks to 23:59 (end of day) — showing that time is noise.
      if (parsed.hour() === 23 && parsed.minute() === 59) {
        return view === "today" ? null : { label: t("dueToday"), tone: "today" };
      }
      return { label: parsed.format("HH:mm"), tone: parsed.isBefore(now) ? "overdue" : "today" };
    }
    if (day.isSame(today.add(1, "day"))) return { label: t("dueTomorrow"), tone: "future" };
    if (day.diff(today, "day") < 7) return { label: parsed.format("ddd"), tone: "future" };
    return { label: dateLabel, tone: "future" };
  };

  // Dated views reserve a fixed-width column so every due value lines up and the icons after it
  // stay aligned across rows. Floater has no due, so no column is reserved.
  const renderDue = (task: TdayTask) => {
    if (view === "floater") return null;
    const info = task.due ? formatDue(task.due) : null;
    return (
      <span className="tday-due" data-tone={info ? (view === "overdue" ? "overdue" : info.tone) : undefined}>
        {info?.label ?? ""}
      </span>
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
    <Stack
      ref={rootRef}
      tabIndex={-1}
      h="100%"
      gap={6}
      p="sm"
      className="tday-root"
      style={
        { "--tday-accent-light": identity.accentLight, "--tday-accent-dark": identity.accentDark } as CSSProperties
      }
    >
      <div className="tday-watermark-layer" aria-hidden>
        <div
          className={
            identity.watermarkFill ? "tday-watermark tday-watermark--fill" : "tday-watermark tday-watermark--stroke"
          }
        >
          {identity.watermark}
        </div>
      </div>
      <Group className="tday-header" justify="space-between" wrap="nowrap" gap="xs">
        <Group gap={7} wrap="nowrap" align="center" style={{ minWidth: 0 }}>
          <HeaderIcon
            size={15}
            className="tday-view-icon"
            style={view === "floater" ? { transform: "scaleX(-1)" } : undefined}
            aria-hidden
          />
          <Text size="sm" fw={600} truncate className="tday-header-title">
            {t(`option.view.option.${view}.title`)}
          </Text>
          <span className="tday-count">{sortedTasks.length}</span>
        </Group>
      </Group>
      {canInteract && editing ? (
        <div className="tday-composer">
          <div className="tday-composer-head">
            <Text className="tday-composer-kicker">{t("editTask")}</Text>
            <ActionIcon
              size="sm"
              variant="subtle"
              color="gray"
              radius="xl"
              onClick={cancelEdit}
              aria-label={t("cancel")}
            >
              <IconX size={14} />
            </ActionIcon>
          </div>
          <TextInput
            ref={editInputRef}
            variant="unstyled"
            classNames={{ input: "tday-composer-input" }}
            spellCheck
            autoCapitalize="sentences"
            autoCorrect="on"
            aria-label={t("editTask")}
            // Let the browser's native right-click menu (spelling suggestions) show instead of
            // Homarr's widget context menu, which otherwise preventDefaults the whole widget.
            onContextMenu={(event) => event.stopPropagation()}
            value={editTitle}
            onChange={(event) => setEditTitle(event.currentTarget.value)}
            onKeyDown={(event) => {
              // IME composition: Enter commits and Escape cancels the conversion, not the composer.
              if (event.nativeEvent.isComposing) return;
              if (event.key === "Enter") {
                event.preventDefault();
                handleEditSave();
              }
              if (event.key === "Escape") {
                cancelEdit();
                restoreFocus();
              }
            }}
            placeholder={t("quickAddPlaceholder")}
            disabled={updateMutation.isPending}
          />
          <div className="tday-composer-controls">
            {prioritySelect(editPriority, setEditPriority, updateMutation.isPending)}
            {listSelect(editListId, setEditListId, updateMutation.isPending)}
            {editing.kind !== "floater" && duePicker(editDue, setEditDue, updateMutation.isPending)}
          </div>
          {editError && (
            <Text size="xs" c="red" px={10} pt={6}>
              {editError}
            </Text>
          )}
          <div className="tday-composer-actions">
            <Button
              size="xs"
              radius="xl"
              variant={confirmDelete ? "light" : "subtle"}
              color="red"
              className={confirmDelete ? "tday-delete-confirm" : undefined}
              leftSection={<IconTrash size={14} />}
              onClick={handleDelete}
              loading={deleteMutation.isPending}
            >
              {confirmDelete ? t("confirmDelete") : t("delete")}
            </Button>
            <Group gap={6} justify="flex-end" style={{ marginLeft: "auto" }}>
              <Button
                className="tday-cancel-btn"
                size="xs"
                radius="xl"
                variant="subtle"
                color="gray"
                onClick={cancelEdit}
              >
                {t("cancel")}
              </Button>
              <Button
                size="xs"
                radius="xl"
                style={submitButtonStyle(editListId)}
                leftSection={<IconCheck size={14} />}
                onClick={handleEditSave}
                loading={updateMutation.isPending}
                disabled={!editTitle.trim()}
              >
                {t("save")}
              </Button>
            </Group>
          </div>
        </div>
      ) : options.showQuickAdd && canInteract ? (
        adding ? (
          <div className="tday-composer">
            <TextInput
              ref={draftInputRef}
              variant="unstyled"
              classNames={{ input: "tday-composer-input" }}
              spellCheck
              autoCapitalize="sentences"
              autoCorrect="on"
              aria-label={t("newTask")}
              // Let the browser's native right-click menu (spelling suggestions) show instead of
              // Homarr's widget context menu, which otherwise preventDefaults the whole widget.
              onContextMenu={(event) => event.stopPropagation()}
              value={draft}
              onChange={(event) => setDraft(event.currentTarget.value)}
              onKeyDown={(event) => {
                // IME composition: Enter commits and Escape cancels the conversion, not the composer.
                if (event.nativeEvent.isComposing) return;
                if (event.key === "Enter") {
                  event.preventDefault();
                  handleQuickAdd();
                }
                if (event.key === "Escape") {
                  cancelAdd();
                  restoreFocus();
                }
              }}
              placeholder={t("quickAddPlaceholder")}
              disabled={quickAddMutation.isPending}
            />
            <div className="tday-composer-controls">
              {prioritySelect(priority, setPriority, quickAddMutation.isPending)}
              {listSelect(listId, setListId, quickAddMutation.isPending)}
              {view !== "floater" && duePicker(addDue, setAddDue, quickAddMutation.isPending)}
            </div>
            {addError && (
              <Text size="xs" c="red" px={10} pt={6}>
                {addError}
              </Text>
            )}
            <div className="tday-composer-actions">
              <Group gap={6} justify="flex-end" style={{ marginLeft: "auto" }}>
                {/* Never disabled: the only remaining dismiss path while the request is in flight. */}
                <Button
                  className="tday-cancel-btn"
                  size="xs"
                  radius="xl"
                  variant="subtle"
                  color="gray"
                  onClick={cancelAdd}
                >
                  {t("cancel")}
                </Button>
                <Button
                  size="xs"
                  radius="xl"
                  style={submitButtonStyle(listId)}
                  leftSection={<IconPlus size={14} />}
                  onClick={handleQuickAdd}
                  loading={quickAddMutation.isPending}
                  disabled={!draft.trim()}
                >
                  {t("quickAdd")}
                </Button>
              </Group>
            </div>
          </div>
        ) : (
          <UnstyledButton ref={ghostAddRef} className="tday-add-ghost" onClick={() => setAdding(true)}>
            <span className="tday-add-ghost-circle" aria-hidden>
              <IconPlus size={12} stroke={2.5} />
            </span>
            <span className="tday-add-ghost-label">{t("addTaskHint")}</span>
          </UnstyledButton>
        )
      ) : null}
      <ScrollArea className="tday-scroll" style={{ flex: 1, minHeight: 0 }} type="auto" offsetScrollbars="y">
        {sortedTasks.length === 0 ? (
          <Center h="100%">
            <div className="tday-empty">
              <span className="tday-empty-mark">
                <IconCheck size={15} stroke={2.5} />
              </span>
              <Text size="sm" fw={600}>
                {t("emptyAllClear")}
              </Text>
              <Text size="xs" c="dimmed" ta="center">
                {t("empty")}
              </Text>
            </div>
          </Center>
        ) : (
          <Stack gap={2}>
            {sortedTasks.map((task) => (
              <Group
                key={`${task.kind}-${task.id}-${task.instanceDate ?? task.due ?? ""}`}
                className="tday-task-row"
                data-completing={pendingId === task.id ? "true" : undefined}
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
                  <Text size="sm" fw={500} className="tday-task-title" style={{ flex: 1, overflowWrap: "anywhere" }}>
                    {task.title}
                  </Text>
                </Group>
                <Group gap={8} wrap="nowrap" align="center" style={{ flexShrink: 0, marginTop: 1 }}>
                  {renderDue(task)}
                  <span className="tday-list-slot">
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
      {toast && (
        <output key={toast.nonce} className="tday-toast" aria-live="polite">
          <span className="tday-toast-check" aria-hidden>
            <IconCheck size={12} stroke={3} />
          </span>
          <Text className="tday-toast-label">{t("completedToast")}</Text>
          <UnstyledButton className="tday-toast-undo" onClick={() => void handleUndo()}>
            {t("undo")}
          </UnstyledButton>
          <ActionIcon
            size="sm"
            variant="subtle"
            color="gray"
            radius="xl"
            onClick={() => setToast(null)}
            aria-label={t("cancel")}
          >
            <IconX size={13} />
          </ActionIcon>
        </output>
      )}
    </Stack>
  );
};

interface ViewIdentity {
  // Light-/dark-theme accent (fed to CSS as custom properties; CSS picks via light-dark()).
  accentLight: string;
  accentDark: string;
  HeaderIcon: LucideIcon;
  watermark: ReactNode;
  // Ported filled paths tint via fill; lucide watermarks are stroked outlines.
  watermarkFill: boolean;
}

// Watermark paths ported verbatim from the native Android widget vector drawables
// (widget_empty_watermark_*.xml) so the Homarr widget's background reads like the app.
const WATERMARK_SUN = (
  <svg viewBox="0 0 24 24" aria-hidden focusable="false">
    <path d="M6.76,4.84L4.96,3.05L3.55,4.46L5.34,6.25L6.76,4.84ZM1,13H4V11H1V13ZM11,1H13V4H11V1ZM20.04,3.45L21.45,4.86L19.66,6.66L18.25,5.24L20.04,3.45ZM17.24,19.16L19.03,20.96L20.44,19.55L18.64,17.76L17.24,19.16ZM20,11V13H23V11H20ZM12,6C8.69,6 6,8.69 6,12C6,15.31 8.69,18 12,18C15.31,18 18,15.31 18,12C18,8.69 15.31,6 12,6ZM12,16C9.79,16 8,14.21 8,12C8,9.79 9.79,8 12,8C14.21,8 16,9.79 16,12C16,14.21 14.21,16 12,16ZM11,20H13V23H11V20ZM3.55,19.55L4.96,20.96L6.75,19.16L5.34,17.75L3.55,19.55Z" />
  </svg>
);
const WATERMARK_MOON = (
  <svg viewBox="0 0 24 24" aria-hidden focusable="false">
    <path d="M11.1,12.08C9.1,8.2 10.18,4.72 11.17,2.81C11.36,2.45 11.05,2.04 10.64,2.09C5.62,2.77 1.78,7.16 1.99,12.41C2,12.41 2,12.41 2,12.42C2.62,12.15 3.29,12 4,12C5.66,12 7.18,12.83 8.1,14.15C9.77,14.63 11,16.17 11,18C11,19.52 10.13,20.83 8.88,21.51C9.86,21.83 10.91,22.01 11.99,22.01C15.12,22.01 17.91,20.57 19.75,18.32C20.01,18 19.79,17.53 19.38,17.5C16.89,17.37 13.1,15.97 11.1,12.08Z" />
    <path d="M7,16H6.82C6.4,14.84 5.3,14 4,14C2.34,14 1,15.34 1,17C1,18.66 2.34,20 4,20C4.62,20 6.49,20 7,20C8.1,20 9,19.1 9,18C9,16.9 8.1,16 7,16Z" />
  </svg>
);
// Shared lucide leaf (same glyph as the app's floater screen), mirrored horizontally so it points
// the same way as the iOS "leaf" symbol. Stroked (watermarkFill: false) to match the app.
const WATERMARK_FLOATER = (
  <svg viewBox="0 0 24 24" aria-hidden focusable="false">
    <g transform="translate(24 0) scale(-1 1)">
      <path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z" />
      <path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12" />
    </g>
  </svg>
);

// Accent colours mirror the native widget/category palette (blue today, amber scheduled,
// red overdue, teal floater; periwinkle for the evening "today" moon).
const resolveViewIdentity = (view: string, isNight: boolean): ViewIdentity => {
  switch (view) {
    case "today":
      return isNight
        ? {
            accentLight: "#8E9FD6",
            accentDark: "#B8C6F4",
            HeaderIcon: Moon,
            watermark: WATERMARK_MOON,
            watermarkFill: true,
          }
        : {
            accentLight: "#6EA8E1",
            accentDark: "#8DC3F3",
            HeaderIcon: Sun,
            watermark: WATERMARK_SUN,
            watermarkFill: true,
          };
    case "scheduled":
      return {
        accentLight: "#C27B36",
        accentDark: "#E0A45E",
        HeaderIcon: CalendarClock,
        watermark: <CalendarClock />,
        watermarkFill: false,
      };
    case "overdue":
      return {
        accentLight: "#D0574E",
        accentDark: "#EC7B73",
        HeaderIcon: Clock3,
        watermark: <Clock3 />,
        watermarkFill: false,
      };
    case "floater":
    default:
      return {
        accentLight: "#4D8F83",
        accentDark: "#7FC7B9",
        HeaderIcon: Leaf,
        watermark: WATERMARK_FLOATER,
        watermarkFill: false,
      };
  }
};

// Tday stores Low/Medium/High; the app surfaces these as Normal/Important/Urgent and shows a
// filled flag only for Important (orange) / Urgent (red). `flag` null = no flag in task rows.
const PRIORITY_META: Record<
  string,
  { key: "priorityNormal" | "priorityImportant" | "priorityUrgent"; flag: string | null }
> = {
  Low: { key: "priorityNormal", flag: null },
  Medium: { key: "priorityImportant", flag: "var(--mantine-color-orange-6)" },
  High: { key: "priorityUrgent", flag: "var(--mantine-color-red-6)" },
};

const PRIORITY_RANK: Record<string, number> = { High: 0, Medium: 1, Low: 2 };

// Mantine date pickers emit "YYYY-MM-DD HH:mm"; Tday expects an ISO local datetime ("…THH:mm").
const toTdayDue = (value: string | null): string | null => (value ? value.replace(" ", "T") : null);

const sortTasks = (tasks: TdayTask[], sort: string): TdayTask[] => {
  if (sort === "priority") {
    return [...tasks].sort((a, b) => (PRIORITY_RANK[a.priority] ?? 9) - (PRIORITY_RANK[b.priority] ?? 9));
  }
  if (sort === "due") {
    return [...tasks].sort((a, b) => (a.due ?? "~").localeCompare(b.due ?? "~"));
  }
  return tasks;
};
