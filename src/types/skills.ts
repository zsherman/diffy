export interface SkillMetadata {
  id: string;
  name: string;
  description: string;
  sourceUrl?: string;
}

export interface Skill extends SkillMetadata {
  content: string; // Full markdown body after frontmatter
}

export interface RemoteSkill {
  owner: string;
  repo: string;
  skill: string;
  url: string;
  installs?: string;
}
