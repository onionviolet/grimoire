/**
 * The base-game voice command catalogue: every command ChatLane knows about.
 *
 * The entries are vendored verbatim from RedMser/ChatLane (MIT,
 * `GUI/autoload/voice_commands_db.gd`, the `VC_LIST` array) at commit
 * 9a71e229f30e7a899699aa5f24d1fbe88da8ce00 (master, 2026-01-24), in VC_LIST
 * order. Whether the bundled ChatLane.exe was built from that exact commit is
 * unverified; that only matters if a future game update renames a command.
 *
 * `id` is the command's display string and IS the key used in the
 * `override_bindable` / `override_ping_wheel_bindable` YAML maps: the wire
 * format has no separate command ID, so the id must never be normalized.
 * `label` is ChatLane's own GUI i18n key, kept for provenance only and never
 * shown to a Grimoire user.
 *
 * Update procedure: fetch `GUI/autoload/voice_commands_db.gd` at master, diff
 * its VC_LIST against the array below, then append or adjust entries here and
 * bump the pinned commit hash in this comment.
 */

export type ChatWheelCommandCategory = 'default' | 'hidden' | 'broken';

export interface ChatWheelCommand {
  readonly id: string;
  readonly label: string;
  readonly category: ChatWheelCommandCategory;
  readonly isMenu: boolean;
  readonly bindable: boolean;
  readonly pingWheelBindable: boolean;
}

export const CHAT_WHEEL_COMMANDS: ReadonlyArray<ChatWheelCommand> = [
  { id: 'Can Heal', label: 'vc-item-can_heal', category: 'default', isMenu: false, bindable: true, pingWheelBindable: true },
  { id: 'Defend Lane', label: 'vc-item-defend_lane', category: 'default', isMenu: true, bindable: true, pingWheelBindable: false },
  { id: 'Going In', label: 'vc-item-going_in', category: 'default', isMenu: false, bindable: true, pingWheelBindable: true },
  { id: 'Good Job', label: 'vc-item-good_job', category: 'default', isMenu: false, bindable: true, pingWheelBindable: true },
  { id: 'Headed to Lane', label: 'vc-item-headed_to_lane', category: 'default', isMenu: true, bindable: true, pingWheelBindable: false },
  { id: 'Headed To Shop/Base', label: 'vc-item-headed_to_shop_base', category: 'default', isMenu: false, bindable: true, pingWheelBindable: true },
  { id: 'Help With Idol', label: 'vc-item-help_with_idol', category: 'default', isMenu: false, bindable: true, pingWheelBindable: true },
  { id: 'Help', label: 'vc-item-help', category: 'default', isMenu: false, bindable: true, pingWheelBindable: true },
  { id: 'Leave Area', label: 'vc-item-leave_area', category: 'default', isMenu: false, bindable: true, pingWheelBindable: true },
  { id: 'Need Heal', label: 'vc-item-need_heal', category: 'default', isMenu: false, bindable: true, pingWheelBindable: true },
  { id: 'No', label: 'vc-item-no', category: 'default', isMenu: false, bindable: true, pingWheelBindable: true },
  { id: 'On My Way', label: 'vc-item-on_my_way', category: 'default', isMenu: false, bindable: true, pingWheelBindable: true },
  { id: 'Push Lane', label: 'vc-item-push_lane', category: 'default', isMenu: true, bindable: true, pingWheelBindable: false },
  { id: 'Retreat', label: 'vc-item-retreat', category: 'default', isMenu: false, bindable: true, pingWheelBindable: true },
  { id: 'Sorry', label: 'vc-item-sorry', category: 'default', isMenu: false, bindable: true, pingWheelBindable: true },
  { id: 'Stay Together', label: 'vc-item-stay_together', category: 'default', isMenu: false, bindable: true, pingWheelBindable: true },
  { id: 'Thanks', label: 'vc-item-thanks', category: 'default', isMenu: false, bindable: true, pingWheelBindable: true },
  { id: 'Need Plan', label: 'vc-item-need_plan', category: 'default', isMenu: false, bindable: true, pingWheelBindable: true },
  { id: 'Yes', label: 'vc-item-yes', category: 'default', isMenu: false, bindable: true, pingWheelBindable: true },
  { id: 'You\'re Welcome', label: 'vc-item-youre_welcome', category: 'default', isMenu: false, bindable: true, pingWheelBindable: true },

  { id: 'Defend Blue', label: 'vc-item-defend_blue', category: 'hidden', isMenu: false, bindable: false, pingWheelBindable: true },
  { id: 'Defend Green', label: 'vc-item-defend_green', category: 'hidden', isMenu: false, bindable: false, pingWheelBindable: true },
  { id: 'Defend Purple', label: 'vc-item-defend_purple', category: 'hidden', isMenu: false, bindable: false, pingWheelBindable: true },
  { id: 'Defend Yellow', label: 'vc-item-defend_yellow', category: 'hidden', isMenu: false, bindable: false, pingWheelBindable: true },
  { id: 'Headed to Blue Subnav', label: 'vc-item-headed_to_blue', category: 'hidden', isMenu: false, bindable: false, pingWheelBindable: true },
  { id: 'Heading to Green Subnav', label: 'vc-item-heading_to_green', category: 'hidden', isMenu: false, bindable: false, pingWheelBindable: true },
  { id: 'Headed to Purple Subnav', label: 'vc-item-headed_to_purple', category: 'hidden', isMenu: false, bindable: false, pingWheelBindable: true },
  { id: 'Heading to Yellow Subnav', label: 'vc-item-heading_to_yellow', category: 'hidden', isMenu: false, bindable: false, pingWheelBindable: true },
  { id: 'Push Blue', label: 'vc-item-push_blue', category: 'hidden', isMenu: false, bindable: false, pingWheelBindable: true },
  { id: 'Push Green', label: 'vc-item-push_green', category: 'hidden', isMenu: false, bindable: false, pingWheelBindable: true },
  { id: 'Push Purple', label: 'vc-item-push_purple', category: 'hidden', isMenu: false, bindable: false, pingWheelBindable: true },
  { id: 'Push Yellow', label: 'vc-item-push_yellow', category: 'hidden', isMenu: false, bindable: false, pingWheelBindable: true },

  { id: 'Good Game (Post Game) - All Chat', label: 'vc-item-good_game_post_game_all_chat', category: 'broken', isMenu: false, bindable: false, pingWheelBindable: false },
  { id: 'Good Job (Post Game) - All Chat', label: 'vc-item-good_job_post_game_all_chat', category: 'broken', isMenu: false, bindable: false, pingWheelBindable: false },
  { id: 'Thanks (Post Game) - All Chat', label: 'vc-item-thanks_post_game_all_chat', category: 'broken', isMenu: false, bindable: false, pingWheelBindable: false },
  { id: 'Well Played (Post Game) - All Chat', label: 'vc-item-well_played_post_game_all_chat', category: 'broken', isMenu: false, bindable: false, pingWheelBindable: false },
  { id: 'Missing', label: 'vc-item-missing', category: 'broken', isMenu: false, bindable: true, pingWheelBindable: true },
  { id: 'Pinged Enemy Player', label: 'vc-item-pinged_enemy_player', category: 'broken', isMenu: false, bindable: false, pingWheelBindable: false },
  { id: 'Pinged Teammate', label: 'vc-item-pinged_teammate', category: 'broken', isMenu: false, bindable: false, pingWheelBindable: false },

  { id: 'Going to Shop', label: 'vc-item-going_to_shop', category: 'default', isMenu: false, bindable: true, pingWheelBindable: true },
  { id: 'Request Follow', label: 'vc-item-request_follow', category: 'default', isMenu: false, bindable: true, pingWheelBindable: true },
  { id: 'Going to Gank', label: 'vc-item-going_to_gank', category: 'default', isMenu: false, bindable: true, pingWheelBindable: true },
  { id: 'Rejuv Drop', label: 'vc-item-rejuv_drop', category: 'default', isMenu: false, bindable: true, pingWheelBindable: true },
  { id: 'Need Cover', label: 'vc-item-need_cover', category: 'default', isMenu: false, bindable: true, pingWheelBindable: true },
  { id: 'Nevermind', label: 'vc-item-nevermind', category: 'default', isMenu: false, bindable: true, pingWheelBindable: true },
  { id: 'No Teamfight', label: 'vc-item-no_teamfight', category: 'default', isMenu: false, bindable: true, pingWheelBindable: true },
  { id: 'Press The Advantage', label: 'vc-item-press_the_advantage', category: 'default', isMenu: false, bindable: true, pingWheelBindable: true },
  { id: 'Lets Hide Here', label: 'vc-item-lets_hide_here', category: 'default', isMenu: false, bindable: true, pingWheelBindable: true },
  { id: 'Its Dangerous', label: 'vc-item-its_dangerous', category: 'default', isMenu: false, bindable: true, pingWheelBindable: true },
  { id: 'I\'ll Clear Troopers', label: 'vc-item-ill_clear_troopers', category: 'default', isMenu: false, bindable: true, pingWheelBindable: true },
  { id: 'Meet Here', label: 'vc-item-meet_here', category: 'default', isMenu: false, bindable: true, pingWheelBindable: true },
  { id: 'Flank', label: 'vc-item-flank', category: 'default', isMenu: false, bindable: true, pingWheelBindable: true },

  { id: 'Pregame Pings', label: 'vc-item-pregame_pings', category: 'broken', isMenu: false, bindable: false, pingWheelBindable: false },
];

/**
 * Exact-match lookup by display string. No trimming or case folding: the YAML
 * key must match exactly for an override entry to round-trip.
 */
export function findChatWheelCommand(id: string): ChatWheelCommand | undefined {
  return CHAT_WHEEL_COMMANDS.find((command) => command.id === id);
}

export const CHAT_WHEEL_COMMAND_COUNTS: {
  readonly all: number;
  readonly default: number;
  readonly hidden: number;
  readonly broken: number;
} = {
  all: CHAT_WHEEL_COMMANDS.length,
  default: CHAT_WHEEL_COMMANDS.filter((command) => command.category === 'default').length,
  hidden: CHAT_WHEEL_COMMANDS.filter((command) => command.category === 'hidden').length,
  broken: CHAT_WHEEL_COMMANDS.filter((command) => command.category === 'broken').length,
};
