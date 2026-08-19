export const APP_TIME_ZONE = "America/Sao_Paulo";

export const APP_TIME_ZONE_SQL = `'${APP_TIME_ZONE}'`;

export const APP_CURRENT_DATE_SQL = `(current_timestamp at time zone ${APP_TIME_ZONE_SQL})::date`;

export const APP_CURRENT_DAY_START_SQL = `date_trunc('day', current_timestamp at time zone ${APP_TIME_ZONE_SQL}) at time zone ${APP_TIME_ZONE_SQL}`;
