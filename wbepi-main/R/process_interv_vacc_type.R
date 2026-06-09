#' Process vacc_type argument
#'
#' This argument indicates the type of reactive vaccination to use, and can be
#' 1L (global) or 2L (targeted)
#'
#' @noRd
#'
process_interv_vacc_type <- function(x) {
  check_rate(x$interv_vacc_type)
  x$interv_vacc_type <- as.integer(x$interv_vacc_type)
  if (!x$interv_vacc_type %in% c(1L, 2L)) {
    msg <- "`interv_vacc_type` should be either 1 (global) or 2 (targeted)"
    stop(msg)
  }
  x
}
