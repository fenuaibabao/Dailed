"use client";

import { useMutation, useQuery } from "convex/react";
import { ConvexError } from "convex/values";
import { useState, type FormEvent, type ReactNode } from "react";
import { api } from "../../../../convex/_generated/api";
import { ASSISTANT_NAME, NOT_A_PERSON } from "@/config/brand";
import { PRODUCTS } from "@/config/products";
import { DailyDashboard, timezoneLabel, type SavedSetup as Saved } from "./DailyDashboard";
import {
  CALL_TIMES,
  CHECK_ITEMS,
  CHECK_ITEM_LABEL,
  COMMON_TIMEZONES,
  DAY_LABELS,
  EXTRA_RECIPIENTS_MAX,
  formatPhone,
  formatTime,
  splitTopics,
  validateDailySetup,
  type DailySetupErrors,
  type DailySetupField,
  type FamilyMember,
} from "@/lib/dailySetup";

function useSavedSetup() {
  return useQuery(api.daily.mySetup, {});
}

type FormState = {
  parentName: string;
  parentPhone: string;
  timezone: string;
  days: number[];
  windowStart: string;
  windowEnd: string;
  talkAbout: string;
  avoid: string;
  checkItems: string[];
  familyMembers: FamilyMember[];
  emergencyName: string;
  emergencyPhone: string;
};

function blankForm(timezone: string | null): FormState {
  const known = timezone && COMMON_TIMEZONES.some((tz) => tz.value === timezone);
  return {
    parentName: "",
    parentPhone: "",
    timezone: known ? timezone : COMMON_TIMEZONES[0].value,
    days: [0, 1, 2, 3, 4, 5, 6],
    windowStart: "09:00",
    windowEnd: "10:00",
    talkAbout: "",
    avoid: "",
    checkItems: [],
    familyMembers: [],
    emergencyName: "",
    emergencyPhone: "",
  };
}

function formFromSaved(saved: Saved): FormState {
  return {
    ...saved,
    parentPhone: formatPhone(saved.parentPhone),
    emergencyPhone: formatPhone(saved.emergencyPhone),
    talkAbout: saved.talkAbout.join(", "),
    avoid: saved.avoid.join(", "),
    checkItems: [...saved.checkItems],
    familyMembers: saved.familyMembers.map((m) => ({ ...m })),
  };
}


function FieldError({ id, error }: { id: string; error?: string }) {
  if (!error) return null;
  return (
    <p id={id} className="mt-1.5 text-sm text-danger">
      {error}
    </p>
  );
}

function Section({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <fieldset className="card mx-0 flex min-w-0 flex-col gap-4 border p-6">
      <legend className="sr-only">{title}</legend>
      <div>
        <h2 className="section-title m-0" aria-hidden="true">
          {title}
        </h2>
        {hint && <p className="mt-1 text-[15px] text-soft">{hint}</p>}
      </div>
      {children}
    </fieldset>
  );
}

/** A labelled text input with its error tied to it for screen readers. */
function TextField({
  id,
  label,
  hint,
  value,
  onChange,
  error,
  type = "text",
  autoComplete = "off",
  placeholder,
}: {
  id: string;
  label: string;
  hint?: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  type?: "text" | "tel";
  autoComplete?: string;
  placeholder?: string;
}) {
  const errorId = `${id}-error`;
  return (
    <div>
      <label htmlFor={id} className="label text-[15px]">
        {label}
      </label>
      {hint && <p className="-mt-1 mb-2 text-sm text-muted">{hint}</p>}
      <input
        id={id}
        type={type}
        inputMode={type === "tel" ? "tel" : undefined}
        autoComplete={autoComplete}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        className="field text-[17px]"
      />
      <FieldError id={errorId} error={error} />
    </div>
  );
}

function TopicsField({
  id,
  label,
  hint,
  value,
  onChange,
  error,
}: {
  id: string;
  label: string;
  hint: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
}) {
  const errorId = `${id}-error`;
  return (
    <div>
      <label htmlFor={id} className="label text-[15px]">
        {label}
      </label>
      <p className="-mt-1 mb-2 text-sm text-muted">{hint}</p>
      <textarea
        id={id}
        rows={2}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        className="field text-[17px]"
      />
      <FieldError id={errorId} error={error} />
    </div>
  );
}

function SetupForm({
  initial,
  ownerEmail,
  onDone,
  onCancel,
}: {
  initial: FormState;
  ownerEmail: string | null;
  onDone: () => void;
  onCancel?: () => void;
}) {
  const save = useMutation(api.daily.saveSetup);
  const [form, setForm] = useState<FormState>(initial);
  const [errors, setErrors] = useState<DailySetupErrors>({});
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function toggleDay(day: number) {
    set("days", form.days.includes(day) ? form.days.filter((d) => d !== day) : [...form.days, day]);
  }

  function toggleCheck(item: string) {
    set("checkItems", form.checkItems.includes(item) ? form.checkItems.filter((c) => c !== item) : [...form.checkItems, item]);
  }

  function setMember(index: number, patch: Partial<FamilyMember>) {
    set(
      "familyMembers",
      form.familyMembers.map((m, i) => (i === index ? { ...m, ...patch } : m)),
    );
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setFailed(null);
    const input = { ...form, talkAbout: splitTopics(form.talkAbout), avoid: splitTopics(form.avoid) };
    const result = validateDailySetup(input);
    if (!result.ok) {
      setErrors(result.errors);
      const first = (Object.keys(result.errors) as DailySetupField[])[0];
      document.getElementById(FIELD_IDS[first])?.focus();
      return;
    }
    setErrors({});
    setPending(true);
    try {
      await save(input);
      onDone();
    } catch (e) {
      const data = e instanceof ConvexError ? (e.data as { fields?: DailySetupErrors }) : null;
      if (data?.fields) setErrors(data.fields);
      else setFailed("Something went wrong saving. Please try again.");
    } finally {
      setPending(false);
    }
  }

  const name = form.parentName.trim() || "your parent";
  const timezones = COMMON_TIMEZONES.some((tz) => tz.value === form.timezone)
    ? COMMON_TIMEZONES
    : [{ value: form.timezone, label: timezoneLabel(form.timezone) }, ...COMMON_TIMEZONES];

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-5">
      <Section title="About your parent">
        <TextField
          id={FIELD_IDS.parentName}
          label={`What should ${ASSISTANT_NAME} call them?`}
          placeholder="Mom, Dad, Margaret…"
          value={form.parentName}
          onChange={(v) => set("parentName", v)}
          error={errors.parentName}
        />
        <TextField
          id={FIELD_IDS.parentPhone}
          type="tel"
          label="Their phone number"
          placeholder="(555) 123-4567"
          value={form.parentPhone}
          onChange={(v) => set("parentPhone", v)}
          error={errors.parentPhone}
        />
        <div>
          <label htmlFor={FIELD_IDS.timezone} className="label text-[15px]">
            Their time zone
          </label>
          <select
            id={FIELD_IDS.timezone}
            value={form.timezone}
            onChange={(e) => set("timezone", e.target.value)}
            className="field text-[17px]"
          >
            {timezones.map((tz) => (
              <option key={tz.value} value={tz.value}>
                {tz.label}
              </option>
            ))}
          </select>
          <FieldError id={`${FIELD_IDS.timezone}-error`} error={errors.timezone} />
        </div>
      </Section>

      <Section
        title="When to call"
        hint={`${ASSISTANT_NAME} calls one time in this window, using ${name === "your parent" ? "your parent's" : `${name}'s`} clock. ${ASSISTANT_NAME} never calls before 8am or after 9pm.`}
      >
        <div role="group" aria-labelledby="days-label" aria-describedby={errors.days ? "days-error" : undefined}>
          <p id="days-label" className="label text-[15px]">
            Days
          </p>
          <div className="flex flex-wrap gap-2">
            {DAY_LABELS.map((label, day) => {
              const on = form.days.includes(day);
              return (
                <button
                  key={label}
                  id={day === 0 ? FIELD_IDS.days : undefined}
                  type="button"
                  aria-pressed={on}
                  onClick={() => toggleDay(day)}
                  className={`btn min-h-12 min-w-14 text-[15px] ${on ? "btn-dark" : ""}`}
                >
                  {label}
                </button>
              );
            })}
          </div>
          <FieldError id="days-error" error={errors.days} />
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label htmlFor={FIELD_IDS.window} className="label text-[15px]">
              Between
            </label>
            <select
              id={FIELD_IDS.window}
              value={form.windowStart}
              onChange={(e) => set("windowStart", e.target.value)}
              aria-invalid={errors.window ? true : undefined}
              aria-describedby={errors.window ? "window-error" : undefined}
              className="field w-36 text-[17px]"
            >
              {CALL_TIMES.slice(0, -1).map((t) => (
                <option key={t} value={t}>
                  {formatTime(t)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="window-end" className="label text-[15px]">
              And
            </label>
            <select
              id="window-end"
              value={form.windowEnd}
              onChange={(e) => set("windowEnd", e.target.value)}
              aria-invalid={errors.window ? true : undefined}
              aria-describedby={errors.window ? "window-error" : undefined}
              className="field w-36 text-[17px]"
            >
              {CALL_TIMES.slice(1).map((t) => (
                <option key={t} value={t}>
                  {formatTime(t)}
                </option>
              ))}
            </select>
          </div>
        </div>
        <FieldError id="window-error" error={errors.window} />
      </Section>

      <Section title="What to talk about" hint="Put a comma between each one.">
        <TopicsField
          id={FIELD_IDS.talkAbout}
          label="Things they love to talk about"
          hint="Like: the garden, the grandkids, church, the Cubs"
          value={form.talkAbout}
          onChange={(v) => set("talkAbout", v)}
          error={errors.talkAbout}
        />
        <TopicsField
          id={FIELD_IDS.avoid}
          label="Topics to stay away from"
          hint="You can skip this. Like: politics, Dad's illness"
          value={form.avoid}
          onChange={(v) => set("avoid", v)}
          error={errors.avoid}
        />
      </Section>

      <Section
        title="Little check-ins"
        hint={`You can skip this. ${ASSISTANT_NAME} asks these the way a friend would, then tells you what ${name} said. ${ASSISTANT_NAME} never gives medical advice.`}
      >
        <div className="space-y-2">
          {CHECK_ITEMS.map((item) => (
            <label key={item} className="flex min-h-11 items-center gap-3 text-[17px]">
              <input
                type="checkbox"
                className="h-5 w-5"
                checked={form.checkItems.includes(item)}
                onChange={() => toggleCheck(item)}
              />
              {CHECK_ITEM_LABEL[item]}
            </label>
          ))}
        </div>
      </Section>

      <Section title="Who gets the note" hint="Everyone here gets a short note after each call, and a message right away if something seems wrong.">
        <p className="m-0 text-[17px]">
          You{ownerEmail ? <span className="text-soft"> ({ownerEmail})</span> : null}
        </p>
        {form.familyMembers.map((member, i) => (
          <div key={i} className="flex flex-wrap items-end gap-3" data-testid="family-member">
            <div className="min-w-40 flex-1">
              <label htmlFor={`member-name-${i}`} className="label text-[15px]">
                Name
              </label>
              <input
                id={`member-name-${i}`}
                value={member.name}
                onChange={(e) => setMember(i, { name: e.target.value })}
                className="field text-[17px]"
              />
            </div>
            <div className="min-w-56 flex-[2]">
              <label htmlFor={`member-email-${i}`} className="label text-[15px]">
                Email
              </label>
              <input
                id={`member-email-${i}`}
                type="email"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                value={member.email}
                onChange={(e) => setMember(i, { email: e.target.value })}
                className="field text-[17px]"
              />
            </div>
            <button
              type="button"
              className="btn min-h-12"
              onClick={() => set("familyMembers", form.familyMembers.filter((_, j) => j !== i))}
            >
              Remove
            </button>
          </div>
        ))}
        {form.familyMembers.length < EXTRA_RECIPIENTS_MAX && (
          <button
            id={FIELD_IDS.familyMembers}
            type="button"
            className="btn min-h-12"
            onClick={() => set("familyMembers", [...form.familyMembers, { name: "", email: "" }])}
          >
            Add someone
          </button>
        )}
        <FieldError id="family-error" error={errors.familyMembers} />
      </Section>

      <Section
        title="Emergency contact"
        hint={`If a call sounds like an emergency, ${ASSISTANT_NAME} tells ${name} to hang up and call 911. Then ${ASSISTANT_NAME} tells you and this person.`}
      >
        <TextField
          id={FIELD_IDS.emergencyName}
          label="Name"
          placeholder="Linda, the neighbor"
          value={form.emergencyName}
          onChange={(v) => set("emergencyName", v)}
          error={errors.emergencyName}
        />
        <TextField
          id={FIELD_IDS.emergencyPhone}
          type="tel"
          label="Phone number"
          placeholder="(555) 987-6543"
          value={form.emergencyPhone}
          onChange={(v) => set("emergencyPhone", v)}
          error={errors.emergencyPhone}
        />
      </Section>

      <div className="card flex flex-col gap-4 p-6">
        <p className="m-0 text-[17px]" data-testid="consent-explainer">
          On the first call, {ASSISTANT_NAME} tells {name} that {ASSISTANT_NAME} is {NOT_A_PERSON}, that calls are recorded,
          and that you get a short note. Then {ASSISTANT_NAME} asks, &ldquo;Can I call you each day?&rdquo; Only {name} can say yes.
        </p>
        {failed && (
          <p role="alert" className="m-0 text-danger">
            {failed}
          </p>
        )}
        {Object.keys(errors).length > 0 && (
          <p role="alert" className="m-0 text-danger">
            Please fix the answers marked in red above.
          </p>
        )}
        <div className="flex flex-wrap gap-3">
          <button type="submit" disabled={pending} className="btn btn-primary btn-lg min-h-14 px-7 text-[17px]">
            {pending ? "Saving…" : "Save setup"}
          </button>
          {onCancel && (
            <button type="button" onClick={onCancel} className="btn btn-lg min-h-14 text-[17px]">
              Cancel
            </button>
          )}
        </div>
      </div>
    </form>
  );
}

const FIELD_IDS: Record<DailySetupField, string> = {
  parentName: "parent-name",
  parentPhone: "parent-phone",
  timezone: "parent-timezone",
  days: "day-0",
  window: "window-start",
  talkAbout: "talk-about",
  avoid: "avoid",
  familyMembers: "add-family",
  emergencyName: "emergency-name",
  emergencyPhone: "emergency-phone",
};

export function DailySetupPanel() {
  const saved = useSavedSetup();
  const viewer = useQuery(api.users.viewer, {});
  const calls = useQuery(api.daily.myCalls, saved ? {} : "skip");
  const alerts = useQuery(api.daily.myAlerts, saved ? {} : "skip");
  const [editing, setEditing] = useState(false);
  const [justSaved, setJustSaved] = useState(false);

  const loading = saved === undefined || viewer === undefined;

  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <div>
        <p className="eyebrow">Daily</p>
        <h1 className="page-title mt-2">
          {saved ? `Daily for ${saved.parentName}` : "Set up Daily for your parent"}
        </h1>
        <p className="mt-3 text-[17px] text-soft">
          {ASSISTANT_NAME} calls your parent at the time you pick for a short, friendly chat. After each call, you get a short note.
        </p>
      </div>

      <p className="notice text-[15px]" data-testid="not-calling-yet">
        Daily is still being tested. For now, {ASSISTANT_NAME} only calls phone numbers on our test list. On the first call,
        your parent decides if the calls keep going.
      </p>
      <p className="m-0 text-sm text-muted">{PRODUCTS.daily.disclaimer}</p>

      {justSaved && !editing && (
        <p role="status" className="notice bg-accent-surface text-[15px] text-foreground">
          Saved.
        </p>
      )}

      {loading ? (
        <p className="text-muted">Loading…</p>
      ) : saved && !editing ? (
        <DailyDashboard
          saved={saved}
          calls={calls ?? []}
          alerts={alerts ?? []}
          onEdit={() => {
            setJustSaved(false);
            setEditing(true);
          }}
        />
      ) : (
        <SetupForm
          initial={saved ? formFromSaved(saved) : blankForm(viewer?.timezone ?? null)}
          ownerEmail={viewer?.email ?? null}
          onDone={() => {
            setEditing(false);
            setJustSaved(true);
            window.scrollTo({ top: 0 });
          }}
          onCancel={saved ? () => setEditing(false) : undefined}
        />
      )}
    </div>
  );
}
