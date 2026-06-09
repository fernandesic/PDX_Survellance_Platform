#' Process time input
#'
#' Time step inputs could be a vector, or a single number. We use this to build
#' a vector of the form 1:n where n is the number of time steps.
#'
#' @noRd
process_time <- function(time) {
  if (!is.null(time)) {
    check_rates(time)
    max_t <- max(time, na.rm = TRUE)
    time <- seq_len(max_t)
  }
  time
}


