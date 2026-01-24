import { Menu } from "@base-ui/react/menu";
import { GearSix, Sun, Moon, Check, CaretUpDown } from "@phosphor-icons/react";
import { useUIStore, useTheme } from "../../stores/ui-store";
import { THEMES, getTheme, isLightTheme, type ThemeId } from "../../lib/themes";

// Inline SVG icons for proper currentColor support
function ClaudeIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      width="14"
      height="14"
      fill="currentColor"
    >
      <path d="M4.709 15.955l4.72-2.647.08-.23-.08-.128H9.2l-.79-.048-2.698-.073-2.339-.097-2.266-.122-.571-.121L0 11.784l.055-.352.48-.321.686.06 1.52.103 2.278.158 1.652.097 2.449.255h.389l.055-.157-.134-.098-.103-.097-2.358-1.596-2.552-1.688-1.336-.972-.724-.491-.364-.462-.158-1.008.656-.722.881.06.225.061.893.686 1.908 1.476 2.491 1.833.365.304.145-.103.019-.073-.164-.274-1.355-2.446-1.446-2.49-.644-1.032-.17-.619a2.97 2.97 0 01-.104-.729L6.283.134 6.696 0l.996.134.42.364.62 1.414 1.002 2.229 1.555 3.03.456.898.243.832.091.255h.158V9.01l.128-1.706.237-2.095.23-2.695.08-.76.376-.91.747-.492.584.28.48.685-.067.444-.286 1.851-.559 2.903-.364 1.942h.212l.243-.242.985-1.306 1.652-2.064.73-.82.85-.904.547-.431h1.033l.76 1.129-.34 1.166-1.064 1.347-.881 1.142-1.264 1.7-.79 1.36.073.11.188-.02 2.856-.606 1.543-.28 1.841-.315.833.388.091.395-.328.807-1.969.486-2.309.462-3.439.813-.042.03.049.061 1.549.146.662.036h1.622l3.02.225.79.522.474.638-.079.485-1.215.62-1.64-.389-3.829-.91-1.312-.329h-.182v.11l1.093 1.068 2.006 1.81 2.509 2.33.127.578-.322.455-.34-.049-2.205-1.657-.851-.747-1.926-1.62h-.128v.17l.444.649 2.345 3.521.122 1.08-.17.353-.608.213-.668-.122-1.374-1.925-1.415-2.167-1.143-1.943-.14.08-.674 7.254-.316.37-.729.28-.607-.461-.322-.747.322-1.476.389-1.924.315-1.53.286-1.9.17-.632-.012-.042-.14.018-1.434 1.967-2.18 2.945-1.726 1.845-.414.164-.717-.37.067-.662.401-.589 2.388-3.036 1.44-1.882.93-1.086-.006-.158h-.055L4.132 18.56l-1.13.146-.487-.456.061-.746.231-.243 1.908-1.312-.006.006z" />
    </svg>
  );
}

function CodeRabbitIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 32 32"
      width="14"
      height="14"
      fill="currentColor"
    >
      <path d="M30 17.85c0 4.07-1.74 7.75-4.52 10.3h-3.36c.07-.32-.1-.55-.33-.7a1.55 1.55 0 0 1-.7-1.44c.19-1.5 1.1-3.4 4.39-5.14c2.23-1.2 2.64-3.65 2.8-4c.22-.6.16-1.1-.31-1.59a9.9 9.9 0 0 0-2.9-2.18a5.92 5.92 0 0 0-4.77-.1c-.28.1-.22-.11-.24-.2a10.8 10.8 0 0 0-1.09-3c-1.03-1.88-2.48-3.25-4.64-3.72c-.32-.07-.65-.09-.98-.13c-.15-.02-.23.02-.2.2A9.1 9.1 0 0 0 14.73 10c.4.52.95.87 1.48 1.23c.57.4 1.16.75 1.7 1.2c.5.43.91.93 1.1 1.65l-.12-.12c-1.64-2.61-4.86-3.77-8.1-2.82c-.3.08-.25.18-.1.4a9.56 9.56 0 0 0 3.73 3.26A10.8 10.8 0 0 0 18 16.02c.57.07.3.46.39.93c.12.71.42.94.32.88a13.4 13.4 0 0 0-4.92-1.09c-5.56 0-6.47 5.3-6.43 5.36c-.08-.03-1.41-.52-1.71.82c-.31 1.35 1.5 2.24 1.5 2.24a2.4 2.4 0 0 1 1.86-2c-.15.08-1.08.63-1.37 2.12c-.25 1.31.8 2.48 1.18 2.88h-2.3A14 14 0 1 1 30 17.86zm-10.17 10.3h-1.48a.55.55 0 0 0 .14-.28c.13-.72-.5-.86-.5-.86h-3.4s1.35-.07 2.6-.58a7.1 7.1 0 0 0 2.4-1.69a3.97 3.97 0 0 0-.06 3.08c.05.14.16.26.3.34z" />
    </svg>
  );
}

function CodexIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      width="14"
      height="14"
      fill="currentColor"
    >
      <path d="M22.2819 9.8211a5.9847 5.9847 0 0 0-.5157-4.9108 6.0462 6.0462 0 0 0-6.5098-2.9A6.0651 6.0651 0 0 0 4.9807 4.1818a5.9847 5.9847 0 0 0-3.9977 2.9 6.0462 6.0462 0 0 0 .7427 7.0966 5.98 5.98 0 0 0 .511 4.9107 6.051 6.051 0 0 0 6.5146 2.9001A5.9847 5.9847 0 0 0 13.2599 24a6.0557 6.0557 0 0 0 5.7718-4.2058 5.9894 5.9894 0 0 0 3.9977-2.9001 6.0557 6.0557 0 0 0-.7475-7.0729zm-9.022 12.6081a4.4755 4.4755 0 0 1-2.8764-1.0408l.1419-.0804 4.7783-2.7582a.7948.7948 0 0 0 .3927-.6813v-6.7369l2.02 1.1686a.071.071 0 0 1 .038.052v5.5826a4.504 4.504 0 0 1-4.4945 4.4944zm-9.6607-4.1254a4.4708 4.4708 0 0 1-.5346-3.0137l.142.0852 4.783 2.7582a.7712.7712 0 0 0 .7806 0l5.8428-3.3685v2.3324a.0804.0804 0 0 1-.0332.0615L9.74 19.9502a4.4992 4.4992 0 0 1-6.1408-1.6464zM2.3408 7.8956a4.485 4.485 0 0 1 2.3655-1.9728V11.6a.7664.7664 0 0 0 .3879.6765l5.8144 3.3543-2.0201 1.1685a.0757.0757 0 0 1-.071 0l-4.8303-2.7865A4.504 4.504 0 0 1 2.3408 7.872zm16.5963 3.8558L13.1038 8.364 15.1192 7.2a.0757.0757 0 0 1 .071 0l4.8303 2.7913a4.4944 4.4944 0 0 1-.6765 8.1042v-5.6772a.79.79 0 0 0-.407-.667zm2.0107-3.0231l-.142-.0852-4.7735-2.7818a.7759.7759 0 0 0-.7854 0L9.409 9.2297V6.8974a.0662.0662 0 0 1 .0284-.0615l4.8303-2.7866a4.4992 4.4992 0 0 1 6.6802 4.66zM8.3065 12.863l-2.02-1.1638a.0804.0804 0 0 1-.038-.0567V6.0742a4.4992 4.4992 0 0 1 7.3757-3.4537l-.142.0805L8.704 5.459a.7948.7948 0 0 0-.3927.6813zm1.0976-2.3654l2.602-1.4998 2.6069 1.4998v2.9994l-2.5974 1.4997-2.6067-1.4997Z" />
    </svg>
  );
}

// CLI Status indicator component
function CLIIndicator({
  name,
  available,
  Icon,
  installInstructions,
}: {
  name: string;
  available: boolean;
  Icon: React.ComponentType<{ className?: string }>;
  installInstructions: string;
}) {
  return (
    <div
      className="flex items-center gap-1.5 cursor-default"
      title={
        available
          ? `${name} is installed`
          : `${name} not found. ${installInstructions}`
      }
    >
      <span
        className={`w-1.5 h-1.5 rounded-full ${
          available ? "bg-accent-green" : "bg-text-muted opacity-50"
        }`}
      />
      <Icon
        className={`w-3 h-3 ${available ? "text-text-muted" : "text-text-muted opacity-30"}`}
      />
      <span
        className={available ? "text-text-muted" : "text-text-muted opacity-30"}
      >
        {name}
      </span>
    </div>
  );
}

export function StatusBar() {
  const { activePanel, setShowSettingsDialog, cliStatus } = useUIStore();
  const { theme, setTheme } = useTheme();
  const currentTheme = getTheme(theme);

  const hints: Record<string, string> = {
    branches: "j/k:navigate | Enter:checkout | Tab:next panel",
    commits: "j/k:navigate | Enter:select | Tab:next panel",
    files: "j/k:navigate | Space:stage | u:unstage | d:discard",
    diff: "v:toggle view | Tab:next panel",
    staging: "Stage/unstage files | Enter:commit",
    "merge-conflict":
      "Ctrl+1:use ours | Ctrl+2:use theirs | Ctrl+Up/Down:navigate files",
  };

  return (
    <div className="flex items-center justify-between px-3 py-1 bg-bg-tertiary border-t border-border-primary text-xs">
      {/* Left: Context-sensitive hints */}
      <div className="text-text-muted">{hints[activePanel]}</div>

      {/* Right: CLI Status, Theme picker, Settings and Help */}
      <div className="flex items-center gap-3 text-text-muted">
        {/* CLI Status Indicators */}
        {cliStatus && (
          <div className="flex items-center gap-4 pr-3 border-r border-border-primary">
            <CLIIndicator
              name="Claude"
              available={cliStatus.claude.available}
              Icon={ClaudeIcon}
              installInstructions={cliStatus.claude.installInstructions}
            />
            <CLIIndicator
              name="CodeRabbit"
              available={cliStatus.coderabbit.available}
              Icon={CodeRabbitIcon}
              installInstructions={cliStatus.coderabbit.installInstructions}
            />
            <CLIIndicator
              name="Codex"
              available={cliStatus.codex.available}
              Icon={CodexIcon}
              installInstructions={cliStatus.codex.installInstructions}
            />
          </div>
        )}
        {/* Theme Picker */}
        <Menu.Root>
          <Menu.Trigger className="flex items-center gap-1.5 px-2 py-1 rounded-sm hover:bg-bg-hover transition-colors hover:text-text-primary cursor-pointer">
            {isLightTheme(theme) ? (
              <Sun size={14} weight="bold" />
            ) : (
              <Moon size={14} weight="bold" />
            )}
            <span className="hidden sm:inline">
              {currentTheme?.label ?? "Theme"}
            </span>
            <CaretUpDown size={10} />
          </Menu.Trigger>
          <Menu.Portal>
            <Menu.Positioner sideOffset={4} className="z-50">
              <Menu.Popup className="min-w-[180px] overflow-hidden rounded-md border border-border-primary bg-bg-secondary shadow-lg outline-hidden">
                {THEMES.map((t) => (
                  <Menu.Item
                    key={t.id}
                    className="flex items-center gap-2 px-3 py-2 text-sm cursor-pointer text-text-primary data-highlighted:bg-bg-hover outline-hidden"
                    onClick={() => setTheme(t.id as ThemeId)}
                  >
                    <span className="w-4">
                      {theme === t.id && (
                        <Check
                          size={14}
                          weight="bold"
                          className="text-accent-green"
                        />
                      )}
                    </span>
                    <span className="flex items-center gap-2">
                      {t.kind === "light" ? (
                        <Sun size={14} className="text-text-muted" />
                      ) : (
                        <Moon size={14} className="text-text-muted" />
                      )}
                      {t.label}
                    </span>
                  </Menu.Item>
                ))}
              </Menu.Popup>
            </Menu.Positioner>
          </Menu.Portal>
        </Menu.Root>

        <button
          onClick={() => setShowSettingsDialog(true)}
          className="p-1 rounded-sm hover:bg-bg-hover transition-colors hover:text-text-primary cursor-pointer"
          title="Settings"
        >
          <GearSix size={16} weight="bold" />
        </button>
        <div className="flex items-center gap-2">
          <span className="px-1.5 py-0.5 bg-bg-hover rounded-sm text-xs">
            ?
          </span>
          <span>help</span>
        </div>
      </div>
    </div>
  );
}
